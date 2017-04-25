'use strict';

const vscode = require('vscode');
const os = require('os');
const opn = require('opn');
const {StateController, Logger} = require('kite-installer');
const {PYTHON_MODE, ATTEMPTS, INTERVAL} = require('./constants');
const KiteHoverProvider = require('./hover');
const KiteCompletionProvider = require('./completion');
const KiteSignatureProvider = require('./signature');
const KiteDefinitionProvider = require('./definition');
const KiteRouter = require('./router');
const KiteEditor = require('./kite-editor');
const metrics = require('./metrics');
const {openDocumentationInWebURL, projectDirPath, shouldNotifyPath} = require('./urls');
// const Rollbar = require('rollbar');
const {editorsForDocument, promisifyRequest, promisifyReadResponse} = require('./utils');

const Kite = {
  activate(ctx) 
  {
    // send the activated event
    metrics.track('activated');

    const router = new KiteRouter(Kite);
    Logger.LEVEL = Logger.LEVELS.DEBUG;

    // Rollbar.init('cce6430d4e25421084d7562afa976886');
    // Rollbar.handleUncaughtExceptions('cce6430d4e25421084d7562afa976886');

    ctx.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('kite-vscode-internal', router));
    ctx.subscriptions.push(
      vscode.languages.registerHoverProvider(PYTHON_MODE, new KiteHoverProvider(Kite)));
    ctx.subscriptions.push(
      vscode.languages.registerDefinitionProvider(PYTHON_MODE, new KiteDefinitionProvider(Kite)));
    ctx.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(PYTHON_MODE, new KiteCompletionProvider(Kite), '.'));
    ctx.subscriptions.push(
      vscode.languages.registerSignatureHelpProvider(PYTHON_MODE, new KiteSignatureProvider(Kite), '(', ','));

    ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {
      if (!this.kiteEditorByEditor.has(e)) {
        this.kiteEditorByEditor.set(
          vscode.window.activeTextEditor, 
          new KiteEditor(Kite, vscode.window.activeTextEditor));
      }

      const evt = this.kiteEditorByEditor.set(e);
      evt.focus();
    }));

    ctx.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e => {
      const evt = this.kiteEditorByEditor.get(e.textEditor);
      evt.selectionChanged();
    }));

    ctx.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
      editorsForDocument(e.document).forEach(e => {
        const evt = this.kiteEditorByEditor.get(e);
        evt.edit();
      })
    }));
    
    vscode.commands.registerCommand('kite.more', ({id, source}) => {
      metrics.track(`${source} See info clicked`);
      const uri = `kite-vscode-internal://value/${id}`;
      router.navigate(uri);
    });

    vscode.commands.registerCommand('kite.more-range', ({range, source}) => {
      metrics.track(`${source} See info clicked`);
      const uri = `kite-vscode-internal://value-range/${JSON.stringify(range)}`;
      router.navigate(uri);
    });

    vscode.commands.registerCommand('kite.navigate', (path) => {
      const uri = `kite-vscode-internal://${path}`;
      router.navigate(uri);
    });
    
    vscode.commands.registerCommand('kite.web', ({id, source}) => {
      metrics.track(`${source} Open in web clicked`);
      opn(openDocumentationInWebURL(id, true));
    });

    vscode.commands.registerCommand('kite.def', ({file, line, source}) => {
      metrics.track(`${source} Go to definition clicked`);
      vscode.workspace.openTextDocument(file).then(doc => {
        editorsForDocument(doc).some(e => {
          e.revealRange(new vscode.Range(
            new vscode.Position(line - 1, 0),
            new vscode.Position(line - 1, 100)
          ));
        });
      })
    });
    
    this.kiteEditorByEditor = new Map();

    if (vscode.window.activeTextEditor) {
      const evt = new KiteEditor(Kite, vscode.window.activeTextEditor);
      this.kiteEditorByEditor.set(vscode.window.activeTextEditor, evt);

      evt.focus();
    }

    this.checkState();
  },
  
  deactivate() {
    // send the activated event
    metrics.track('deactivated');
  },

  checkState() {
    StateController.handleState().then(state => {
      switch (state) {
        case StateController.STATES.UNSUPPORTED:
          if (!StateController.isOSSupported()) {
            metrics.track('OS unsupported');
          } else if (!StateController.isOSVersionSupported()) {
            metrics.track('OS version unsupported');
          }
          vscode.window.showErrorMessage('Sorry, the Kite engine is currently not supported on your platform');
          break;
        case StateController.STATES.UNINSTALLED:
          vscode.window.showErrorMessage('Kite is not installed: Grab the installer from our website', 'Get Kite').then(item => {
            if (item) { opn('https://kite.com/'); }
          });
          break;
        case StateController.STATES.INSTALLED:
          vscode.window.showErrorMessage('Kite is not running: Start the Kite background service to get Python completions, documentation, and examples.', 'Launch Kite').then(item => {
            if (item) {
              return StateController.runKiteAndWait(ATTEMPTS, INTERVAL)
              .then(() => this.checkState())
              .catch(err => console.error(err));
            }
          })
          break;
        case StateController.STATES.RUNNING:
          vscode.window.showErrorMessage('The Kite background service is running but not reachable.');
          break;
        case StateController.STATES.REACHABLE:
          vscode.window.showErrorMessage('You need to login to the Kite engine', 'Login').then(item => {
            if (item) { opn('http://localhost:46624/login'); }
          })
          break;
      }
    }).catch(err => {
      console.error(err);
    });
  },

  handle403Response(document, resp) {
    // for the moment a 404 response is sent for non-whitelisted file by
    // the tokens endpoint
    if (resp.statusCode === 403) {
      this.shouldOfferWhitelist(document)
      .then(res => {
        console.log(res);
        if (res) {
          this.warnNotWhitelisted(document, res);
        }
      })
      .catch(err => console.error(err));
    }
  },

  shouldOfferWhitelist(document) {
    return this.projectDirForEditor(document)
    .then(path =>
      this.shouldNotify(document)
      .then(res => res ? path : null)
      .catch(() => null));
  },
  
  warnNotWhitelisted(document, res) {
    vscode.window.showErrorMessage(
      `The Kite engine is disabled for ${document.fileName}`,
      `Whitelist ${res}`
    ).then(item => {
      return item 
        ? StateController.whitelistPath(res)
          .then(() => console.log('whitelisted'))
        : StateController.blacklistPath(res)
          .then(() => console.log('blacklisted'));
    });
  },

  projectDirForEditor(document) {
    const filepath = document.fileName;
    const path = projectDirPath(filepath);

    return promisifyRequest(StateController.client.request({path}))
    .then(resp => {
      Logger.logResponse(resp);
      if (resp.statusCode === 403) {
        return null;
      } else if (resp.statusCode === 404) {
        return vscode.workspace.rootPath || os.homedir();
      } else if (resp.statusCode !== 200) {
        return promisifyReadResponse(resp).then(data => {
          throw new Error(`Error ${resp.statusCode}: ${data}`);
        });
      } else {
        return promisifyReadResponse(resp).catch(() => null);
      }
    });
  },

  shouldNotify(document) {
    const filepath = document.fileName;
    const path = shouldNotifyPath(filepath);

    return promisifyRequest(StateController.client.request({path}))
    .then(resp => resp.statusCode === 200)
    .catch(() => false);
  },
}

module.exports = {
  activate(ctx) { Kite.activate(ctx); },
  deactivate() { Kite.deactivate(); },
}