'use strict';

const vscode = require('vscode');
const os = require('os');
const opn = require('opn');
const KiteAPI = require('kite-api');
const {Logger} = require('kite-installer');
const {PYTHON_MODE, ERROR_COLOR, SUPPORTED_EXTENSIONS} = require('./constants');
const KiteHoverProvider = require('./hover');
const KiteCompletionProvider = require('./completion');
const KiteSignatureProvider = require('./signature');
const KiteDefinitionProvider = require('./definition');
const KiteEditor = require('./kite-editor');
const EditorEvents = require('./events');
const localconfig = require('./localconfig');
const metrics = require('./metrics');
const server = require('./server');
const {statusPath, languagesPath, hoverPath} = require('./urls');
const Rollbar = require('rollbar');
const {editorsForDocument, promisifyReadResponse, params, kiteOpen} = require('./utils');
const {version} = require('../package.json');

const Kite = {
  activate(ctx) {
    if(process.env.NODE_ENV !== 'test') {
      this._activate()
      ctx.subscriptions.push(this);
    }
  },

  _activate() {
    metrics.featureRequested('starting');

    this.reset();

    const rollbar = new Rollbar({
      accessToken: '4ca1bfd4721544e487c76583478a436a',
      payload: {
        environment: process.env.NODE_ENV,
        editor: 'vscode',
        kite_plugin_version: version,
        os: os.type() + ' ' + os.release(),
      },
    });

    const tracker = (err) => {
      if (err.stack.indexOf('kite') > -1) {
        rollbar.error(err);
      }
    }
    process.on('uncaughtException', tracker);
    this.disposables.push({
      dispose() {
        process.removeListener('uncaughtException', tracker);
      }
    })

    Logger.LEVEL = Logger.LEVELS[vscode.workspace.getConfiguration('kite').loggingLevel.toUpperCase()];

    KiteAPI.isKiteInstalled().catch(err => {
      if (err.message.includes("Unable to find Kite application install")) {
        vscode.window.showInformationMessage('Unable to find Kite Engine. The Kite Engine is needed to power Kite\'s completions experience.', 'Install').then(item => {
          if (item) {
            switch(item) {
              case 'Install':
                opn('https://github.com/kiteco/vscode-plugin#installation');
                break;
            }
          }
        });
      }
    });

    // send the activated event
    metrics.track('activated');

    this.disposables.push(server);

    server.addRoute('GET', '/check', (req, res) => {
      this.checkState('/check route');
      res.writeHead(200);
      res.end();
    });

    server.addRoute('GET', '/count', (req, res, url) => {
      const {metric, name} = params(url);
      if (metric === 'requested') {
        metrics.featureRequested(name);
      } else if (metric === 'fulfilled') {
        metrics.featureFulfilled(name);
      }
      res.writeHead(200);
      res.end();
    });

    server.start();

    this.disposables.push(
      vscode.languages.registerHoverProvider(PYTHON_MODE, new KiteHoverProvider(Kite)));
    this.disposables.push(
      vscode.languages.registerDefinitionProvider(PYTHON_MODE, new KiteDefinitionProvider(Kite)));
    this.disposables.push(
      vscode.languages.registerCompletionItemProvider(PYTHON_MODE, new KiteCompletionProvider(Kite), '.', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'));
    this.disposables.push(
      vscode.languages.registerSignatureHelpProvider(PYTHON_MODE, new KiteSignatureProvider(Kite), '(', ','));

    this.disposables.push(vscode.workspace.onDidChangeConfiguration(() => {
      Logger.LEVEL = Logger.LEVELS[vscode.workspace.getConfiguration('kite').loggingLevel.toUpperCase()];
    }));

    this.disposables.push(vscode.window.onDidChangeActiveTextEditor(e => {
      this.setStatusBarLabel();
      if (e) {
        if (/Code[\/\\]User[\/\\]settings.json$/.test(e.document.fileName)){
          metrics.featureRequested('settings');
          metrics.featureFulfilled('settings');
        }
        if (this.isGrammarSupported(e)) {
          this.registerEvents(e);
          this.registerEditor(e);
        }

        const evt = this.eventsByEditor.get(e.document.fileName);
        evt && evt.focus();
      }
    }));

    this.disposables.push(vscode.window.onDidChangeTextEditorSelection(e => {
      const evt = this.eventsByEditor.get(e.textEditor.document.fileName);
      evt && evt.selectionChanged();
    }));

    this.disposables.push(vscode.workspace.onDidChangeTextDocument(e => {
      e.document && editorsForDocument(e.document).forEach(e => {
        const evt = this.eventsByEditor.get(e.document.fileName);
        evt && evt.edit();
      })
    }));

    this.disposables.push(vscode.window.onDidChangeVisibleTextEditors(editors => {
      editors.forEach((e) => {
        if (e.document.languageId === 'python') {
          this.registerDocumentEvents(e.document);
          this.registerDocument(e.document);
        }
      })
    }));

    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
    this.statusBarItem.text = '𝕜𝕚𝕥𝕖';
    this.statusBarItem.color = undefined;
    this.statusBarItem.show();

    this.disposables.push(this.statusBarItem);

    this.disposables.push(vscode.commands.registerCommand('kite.login', () => {
      kiteOpen('kite://home');
    }));

    this.disposables.push(vscode.commands.registerCommand('kite.open-settings', () => {
      kiteOpen('kite://settings');
    }));

    this.disposables.push(vscode.commands.registerCommand('kite.open-copilot', () => {
      kiteOpen('kite://home');
    }));

    this.disposables.push(vscode.commands.registerCommand('kite.more', ({id, source}) => {
      metrics.track(`${source} See info clicked`);
      kiteOpen(`kite://docs/${id}`);
    }));

    this.disposables.push(vscode.commands.registerCommand('kite.more-position', ({position, source}) => {
      metrics.track(`${source} See info clicked`);
      const doc = vscode.window.activeTextEditor.document;
      const path = hoverPath(doc, position);
      return this.request({path})
      .then(data => JSON.parse(data))
      .then(data => {
        kiteOpen(`kite://docs/${data.symbol[0].id}`)
      })
    }));

    this.disposables.push(vscode.commands.registerCommand('kite.web-url', (url) => {
      opn(url.replace(/;/g, '%3B'));
    }));

    this.disposables.push(vscode.commands.registerCommand('kite.def', ({file, line, character, source}) => {
      metrics.track(`${source} Go to definition clicked`);
      metrics.featureRequested('definition');
      vscode.workspace.openTextDocument(vscode.Uri.file(file))
      .then(doc => {
        return vscode.window.showTextDocument(doc);
      })
      .then(e => {
        metrics.featureFulfilled('definition');
        const newPosition = new vscode.Position(line - 1, character ? character - 1 : 0);
        e.revealRange(new vscode.Range(
          newPosition,
          new vscode.Position(line - 1, 100)
        ));

        const newSelection = new vscode.Selection(newPosition, newPosition);
        e.selection = newSelection;
      })
    }));

    this.disposables.push(vscode.commands.registerCommand('kite.help', () => {
      opn('https://help.kite.com/category/46-vs-code-integration');
    }));

    this.disposables.push(vscode.commands.registerCommand('kite.docs-at-cursor', () => {
      const editor = vscode.window.activeTextEditor;

      if (editor) {
        const pos = editor.selection.active;
        const {document} = editor;

        const path = hoverPath(document, pos)
        KiteAPI.request({path})
          .then(resp => {
            if(resp.statusCode === 200) {
              vscode.commands.executeCommand('kite.more-position', {
                position: pos,
                source: 'Command',
              })
            }
          })
      }
    }));

    this.disposables.push(vscode.commands.registerCommand('kite.usage', ({file, line, source}) => {
      metrics.track(`${source} Go to usage clicked`);
      metrics.featureRequested('usage');
      vscode.workspace.openTextDocument(file).then(doc => {
        metrics.featureFulfilled('usage');
        editorsForDocument(doc).some(e => {
          e.revealRange(new vscode.Range(
            new vscode.Position(line - 1, 0),
            new vscode.Position(line - 1, 100)
          ));
        });
      })
    }));

    const config = vscode.workspace.getConfiguration('kite');
    if (config.showWelcomeNotificationOnStartup) {
      vscode.window.showInformationMessage('Welcome to Kite for VS Code', 'Learn how to use Kite', "Don't show this again").then(item => {
        if (item) {
          switch(item) {
            case 'Learn how to use Kite':
              opn('http://help.kite.com/category/46-vs-code-integration');
              break;
            case "Don't show this again":
              config.update('showWelcomeNotificationOnStartup', false, true);
              break;
          }
        }
      });
    }

    setTimeout(() => {
      vscode.window.visibleTextEditors.forEach(e => {
        if (e.document.languageId === 'python') {
          this.registerEvents(e);
          this.registerEditor(e);

          if (e === vscode.window.activeTextEditor) {
            const evt = this.eventsByEditor.get(e.document.fileName)
            evt && evt.focus();
          }
        }
      })

      this.checkState('activationCheck');
    }, 100);

    this.pollingInterval = setInterval(() => {
      this.checkState('pollingInterval');
    }, config.get('pollingInterval') || 5000);

    metrics.featureFulfilled('starting');

    return this;
  },

  reset() {
    this.disposables && this.disposables.forEach((disposable) => {
      disposable.dispose();
    })
    this.kiteEditorByEditor = new Map();
    this.eventsByEditor = new Map();
    this.supportedLanguages = [];
    this.shown = {};
    this.disposables = [];
    this.attemptedToStartKite = false;
    delete this.shownNotifications;
    delete this.lastState;
    delete this.lastStatus;
    delete this.lastPolledState;
    delete this.pollingInterval;
  },

  deactivate() {
    for(const [, ke] of this.kiteEditorByEditor) {
      ke && ke.dispose();
    }
    for(const [, evt] of this.eventsByEditor) {
      evt && evt.dispose();
    }
    metrics.featureRequested('stopping');
    // send the activated event
    metrics.track('deactivated');
    metrics.featureFulfilled('stopping');
    this.dispose();
    this.reset();
  },

  dispose() {
    this.disposables && this.disposables.forEach(d => d.dispose())
    delete this.disposables;
  },

  registerDocument(document) {
    editorsForDocument(document).forEach(e => this.registerEditor(e));
  },

  registerDocumentEvents(document) {
    editorsForDocument(document).forEach(e => this.registerEvents(e));
  },

  registerEvents(e) {
    if (e && e.document && !this.eventsByEditor.has(e.document.fileName)) {
      const evt = new EditorEvents(this, e);
      this.eventsByEditor.set(e.document.fileName, evt);
    }
  },

  registerEditor(e) {
    if (this.kiteEditorByEditor.has(e.document.fileName)) {
      const ke = this.kiteEditorByEditor.get(e.document.fileName);
      ke.editor = e
    } else {
      Logger.debug('register kite editor for', e.document.fileName, e.document.languageId);
      const ke = new KiteEditor(Kite, e);
      this.kiteEditorByEditor.set(e.document.fileName, ke);
    }
  },

  checkState(src) {
    return Promise.all([
      KiteAPI.checkHealth(),
      this.getSupportedLanguages().catch(() => []),
    ]).then(([state, languages]) => {
      this.supportedLanguages = languages;

      if (state > KiteAPI.STATES.INSTALLED) {
        localconfig.set('wasInstalled', true);
      }

      switch (state) {
        case KiteAPI.STATES.UNSUPPORTED:
          if (this.shown[state] || !this.isGrammarSupported(vscode.window.activeTextEditor)) { return state; }
          this.shown[state] = true;
          if (!KiteAPI.isOSSupported()) {
            metrics.track('OS unsupported');
          } else if (!KiteAPI.isOSVersionSupported()) {
            metrics.track('OS version unsupported');
          }
          this.showErrorMessage('Sorry, the Kite engine is currently not supported on your platform');
          break;
        case KiteAPI.STATES.UNINSTALLED:
          if (this.shown[state] || (vscode.window.activeTextEditor && !this.isGrammarSupported(vscode.window.activeTextEditor))) {
            return state;
          }
          this.shown[state] = true;
          break;
        case KiteAPI.STATES.INSTALLED:
          if(!this.attemptedToStartKite && vscode.workspace.getConfiguration('kite').startKiteEngineOnStartup) {
            KiteAPI.runKiteAndWait().then(() => this.checkState(src));
            this.attemptedToStartKite = true;
          }
          break;
        case KiteAPI.STATES.RUNNING:
          if (this.shown[state] || !this.isGrammarSupported(vscode.window.activeTextEditor)) { return state; }
          break;
        default:
          if (this.isGrammarSupported(vscode.window.activeTextEditor)) {
            this.registerEditor(vscode.window.activeTextEditor);
          }
          if(src && (src === 'pollingInterval' || src === 'activationCheck')) this.lastPolledState = state
          return state;
      }
      //state caching for capturihg false positives in kited restart race condition
      //we do this only for checkState invocations coming from the polling or initial activation
      //script to eliminate the possible case where multiple editor events were generated quickly
      //while kited was restarting
      if(src && (src === 'pollingInterval' || src === 'activationCheck')) this.lastPolledState = state
      return state;
    })
    .then(state => {
      this.setStatus(state, this.isGrammarSupported(vscode.window.activeTextEditor) ? vscode.window.activeTextEditor.document : null);
    })
    .catch(err => {
      console.error(err);
    });
  },

  showErrorMessage(message, ...actions) {
    this.shownNotifications = this.shownNotifications || {};

    if (!this.shownNotifications[message]) {
      this.shownNotifications[message] = true;
      return vscode.window.showErrorMessage(message, ...actions).then(item => {
        delete this.shownNotifications[message];
        return item;
      });
    } else {
      return Promise.resolve();
    }
  },

  setStatusBarLabel() {
    const state = this.lastState;
    const status = this.lastStatus;

    const supported = this.isGrammarSupported(vscode.window.activeTextEditor);

    if(supported) {
      this.statusBarItem.show();
      switch (state) {
        case KiteAPI.STATES.UNSUPPORTED:
          this.statusBarItem.tooltip = 'Kite engine is currently not supported on your platform';
          this.statusBarItem.color = ERROR_COLOR;
          this.statusBarItem.text = '𝕜𝕚𝕥𝕖: not supported';
          break;
        case KiteAPI.STATES.UNINSTALLED:
          this.statusBarItem.text = '𝕜𝕚𝕥𝕖: not installed';
          this.statusBarItem.tooltip = 'Kite engine is not installed';
          this.statusBarItem.color = ERROR_COLOR;
          break;
        case KiteAPI.STATES.INSTALLED:
          this.statusBarItem.text = '𝕜𝕚𝕥𝕖: not running';
          this.statusBarItem.tooltip = 'Kite engine is not running';
          this.statusBarItem.color = ERROR_COLOR;
          break;
        case KiteAPI.STATES.RUNNING:
          this.statusBarItem.text = '𝕜𝕚𝕥𝕖: not reachable';
          this.statusBarItem.tooltip = 'Kite engine is not reachable';
          this.statusBarItem.color = ERROR_COLOR;
          break;
        default:
          if(status) {
            switch(status.status) {
              case 'indexing':
                this.statusBarItem.color = undefined;
                this.statusBarItem.text = '𝕜𝕚𝕥𝕖: indexing'
                this.statusBarItem.tooltip = 'Kite engine is indexing your code';
                break;
              case 'syncing':
                this.statusBarItem.text = '𝕜𝕚𝕥𝕖: syncing'
                this.statusBarItem.color = undefined;
                this.statusBarItem.tooltip = 'Kite engine is syncing your code';
                break;
              case 'ready':
                this.statusBarItem.text = '𝕜𝕚𝕥𝕖';
                this.statusBarItem.color = undefined;
                this.statusBarItem.tooltip = 'Kite is ready';
                break;
            }
          } else {
            this.statusBarItem.text = '';
            this.statusBarItem.color = undefined;
            this.statusBarItem.tooltip = '';
            this.statusBarItem.hide();
          }
      }
    } else {
      this.statusBarItem.text = '';
      this.statusBarItem.color = undefined;
      this.statusBarItem.tooltip = '';
      this.statusBarItem.hide();
    }
  },

  setStatus(state = this.lastState, document) {
    this.lastState = state;
    this.getStatus(document).then(status => {
      this.lastStatus = status;
      this.setStatusBarLabel();
    })
  },

  isGrammarSupported(e) {
    return e && this.isDocumentGrammarSupported(e.document);
  },

  isDocumentGrammarSupported(d) {
    return d &&
           this.supportedLanguages.includes(d.languageId) &&
           SUPPORTED_EXTENSIONS[d.languageId](d.fileName);
  },

  documentForPath(path) {
    return vscode.workspace.textDocuments.filter(d => d.fileName === path).shift();
  },

  getStatus(document) {
    if (!document) { return Promise.resolve({status: 'ready'}); }

    const path = statusPath(document.fileName);

    return KiteAPI.request({path})
    .then(resp => {
      if (resp.statusCode === 200) {
        return promisifyReadResponse(resp).then(json => JSON.parse(json));
      }
    })
    .catch(() => ({status: 'ready'}));
  },

  getSupportedLanguages() {
    const path = languagesPath();
    return this.request({path})
    .then(json => JSON.parse(json))
    .catch(() => ['python']);
  },

  request(req, data) {
    return KiteAPI.request(req, data).then(resp => promisifyReadResponse(resp));
  },

  checkConnectivity() {
    return new Promise((resolve, reject) => {
      require('dns').lookup('kite.com', (err) => {
        if (err && err.code == "ENOTFOUND") {
          reject();
        } else {
          resolve();
        }
      });
    });
  },
}

module.exports = {
  activate(ctx) { return Kite.activate(ctx); },
  deactivate() { Kite.deactivate(); },
  request(...args) { return Kite.request(...args); },
  kite: Kite,
}
