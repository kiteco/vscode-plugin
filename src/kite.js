'use strict';

const vscode = require('vscode');
const os = require('os');
const opn = require('opn');
const {StateController, AccountManager, Logger} = require('kite-installer');
const {PYTHON_MODE, ATTEMPTS, INTERVAL, ERROR_COLOR, WARNING_COLOR, NOT_WHITELISTED} = require('./constants');
const KiteHoverProvider = require('./hover');
const KiteCompletionProvider = require('./completion');
const KiteSignatureProvider = require('./signature');
const KiteDefinitionProvider = require('./definition');
const KiteRouter = require('./router');
const KiteSearch = require('./search');
const KiteLogin = require('./login');
const KiteStatus = require('./status');
const KiteEditor = require('./kite-editor');
const EditorEvents = require('./events');
const metrics = require('./metrics');
const Plan = require('./plan');
const server = require('./server');
const {openDocumentationInWebURL, projectDirPath, shouldNotifyPath, appendToken} = require('./urls');
const Rollbar = require('rollbar');
const {editorsForDocument, promisifyRequest, promisifyReadResponse} = require('./utils');

const pluralize = (n, singular, plural) => n === 1 ? singular : plural;

const Kite = {
  activate(ctx) 
  {
    this.kiteEditorByEditor = new Map();
    this.eventsByEditor = new Map();

    const router = new KiteRouter(Kite);
    const search = new KiteSearch(Kite);
    const login = new KiteLogin(Kite);
    const status = new KiteStatus(Kite);

    Logger.LEVEL = Logger.LEVELS[vscode.workspace.getConfiguration('kite').loggingLevel.toUpperCase()];

    // send the activated event
    metrics.track('activated');
    
    Rollbar.init('4ca1bfd4721544e487c76583478a436a');
    Rollbar.handleUncaughtExceptions('4ca1bfd4721544e487c76583478a436a');

    AccountManager.initClient(
      StateController.client.hostname,
      StateController.client.port,
      ''
    );

    ctx.subscriptions.push(server);
    ctx.subscriptions.push(router);
    ctx.subscriptions.push(search);
    ctx.subscriptions.push(status);

    server.addRoute('GET', '/check', (req, res) => {
      this.checkState();
      res.writeHead(200);
      res.end();
    });
    
    ctx.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('kite-vscode-sidebar', router));
    ctx.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('kite-vscode-search', search));
    ctx.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('kite-vscode-login', login));
    ctx.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('kite-vscode-status', status));

    ctx.subscriptions.push(
      vscode.languages.registerHoverProvider(PYTHON_MODE, new KiteHoverProvider(Kite)));
    ctx.subscriptions.push(
      vscode.languages.registerDefinitionProvider(PYTHON_MODE, new KiteDefinitionProvider(Kite)));
    ctx.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(PYTHON_MODE, new KiteCompletionProvider(Kite), '.'));
    ctx.subscriptions.push(
      vscode.languages.registerSignatureHelpProvider(PYTHON_MODE, new KiteSignatureProvider(Kite), '(', ','));

    ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
      Logger.LEVEL = Logger.LEVELS[vscode.workspace.getConfiguration('kite').loggingLevel.toUpperCase()];
    }));

    ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {
      this.registerEvents(e);
      if (this.isGrammarSupported(e)) { this.registerEditor(e); }

      const evt = this.eventsByEditor.get(e);
      evt.focus();
    }));

    ctx.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e => {
      const evt = this.eventsByEditor.get(e.textEditor);
      evt.selectionChanged();
    }));

    ctx.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
      e.document && editorsForDocument(e.document).forEach(e => {
        const evt = this.eventsByEditor.get(e);
        evt.edit();
      })
    }));

    ctx.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
      this.registerDocumentEvents(doc);
      if (doc.languageId === 'python') {
        this.registerDocument(doc);
      }
    }));

    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this.statusBarItem.text = '$(primitive-dot) Kite';
    this.statusBarItem.color = '#abcdef';
    this.statusBarItem.command = 'kite.status';
    this.statusBarItem.show();

    ctx.subscriptions.push(this.statusBarItem);
    
    vscode.commands.registerCommand('kite.status', () => {
      vscode.commands.executeCommand('vscode.previewHtml', 'kite-vscode-status://status', vscode.ViewColumn.Two, 'Kite Status');
    });

    vscode.commands.registerCommand('kite.search', () => {
      search.clearCache();
      vscode.commands.executeCommand('vscode.previewHtml', 'kite-vscode-search://search', vscode.ViewColumn.Two, 'Kite Search');
    }); 
    
    vscode.commands.registerCommand('kite.login', () => {
      vscode.commands.executeCommand('vscode.previewHtml', 'kite-vscode-login://login', vscode.ViewColumn.Two, 'Kite Login');
    }); 

    vscode.commands.registerCommand('kite.open-settings', () => {
      opn(appendToken('http://localhost:46624/settings'));
    });

    vscode.commands.registerCommand('kite.open-permissions', () => {
      opn(appendToken('http://localhost:46624/settings/permissions'));
    });

    vscode.commands.registerCommand('kite.more', ({id, source}) => {
      metrics.track(`${source} See info clicked`);
      const uri = `kite-vscode-sidebar://value/${id}`;
      router.clearNavigation();
      router.navigate(uri);
    });

    vscode.commands.registerCommand('kite.previous', () => {
      metrics.track(`Back navigation clicked`);
      router.back();
    });

    vscode.commands.registerCommand('kite.next', () => {
      metrics.track(`Forward navigation clicked`);
      router.forward();
    });

    vscode.commands.registerCommand('kite.more-range', ({range, source}) => {
      metrics.track(`${source} See info clicked`);
      const uri = `kite-vscode-sidebar://value-range/${JSON.stringify(range)}`;
      router.clearNavigation();
      router.navigate(uri);
    });

    vscode.commands.registerCommand('kite.navigate', (path) => {
      const uri = `kite-vscode-sidebar://${path}`;
      router.chopNavigation();
      router.navigate(uri);
    });
    
    vscode.commands.registerCommand('kite.web', ({id, source}) => {
      metrics.track(`${source} Open in web clicked`);
      opn(openDocumentationInWebURL(id, true));
    });

    vscode.commands.registerCommand('kite.web-url', (url) => {
      metrics.track(`Open in web clicked`);
      opn(appendToken(url));
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

    setTimeout(() => {
      vscode.window.visibleTextEditors.forEach(e => {
        if (e.document.languageId === 'python') {
          this.registerEditor(e);
        }
      })

      this.checkState();
    }, 100);
  },
  
  deactivate() {
    // send the activated event
    metrics.track('deactivated');
  },

  registerDocument(document) {
    editorsForDocument(document).forEach(e => this.registerEditor(e));
  },
  
  registerDocumentEvents(document) {
    editorsForDocument(document).forEach(e => this.registerEvents(e));
  },

  registerEvents(e) {
    if (!this.eventsByEditor.has(e)) {
      const evt = new EditorEvents(this, e);
      this.eventsByEditor.set(e, evt);

      if (e === vscode.window.activeTextEditor) {
        evt.focus();
      }
    }
  },

  registerEditor(e) {
    if (!this.kiteEditorByEditor.has(e)) {
      Logger.debug('register kite editor for', e.document.fileName, e.document.languageId);
      const evt = new KiteEditor(Kite, e);
      this.kiteEditorByEditor.set(e, evt);
    }
  },

  checkState() {
    return StateController.handleState().then(state => {
      switch (state) {
        case StateController.STATES.UNSUPPORTED:
          if (!StateController.isOSSupported()) {
            metrics.track('OS unsupported');
          } else if (!StateController.isOSVersionSupported()) {
            metrics.track('OS version unsupported');
          }
          this.showErrorMessage('Sorry, the Kite engine is currently not supported on your platform');
          break;
        case StateController.STATES.UNINSTALLED:
          this.showErrorMessage('Kite is not installed: Grab the installer from our website', 'Get Kite').then(item => {
            if (item) { opn('https://kite.com/'); }
          });
          break;
        case StateController.STATES.INSTALLED:
          Promise.all([
            StateController.isKiteInstalled().then(() => true).catch(() => false),
            StateController.isKiteEnterpriseInstalled().then(() => true).catch(() => false),
          ]).then(([kiteInstalled, kiteEnterpriseInstalled]) => {
            if (StateController.hasManyKiteInstallation() ||
                StateController.hasManyKiteEnterpriseInstallation()) {
              this.showErrorMessage('You have multiple versions of Kite installed. Please launch your desired one.');
            } else if (kiteInstalled && kiteEnterpriseInstalled) {
              this.showErrorMessage('Kite is not running: Start the Kite background service to get Python completions, documentation, and examples.', 'Launch Kite Enterprise', 'Launch Kite Cloud').then(item => {
                if (item === 'Launch Kite Cloud') {
                  return StateController.runKiteAndWait(ATTEMPTS, INTERVAL)
                  .then(() => this.checkState())
                  .catch(err => console.error(err));
                } else if (item === 'Launch Kite Enterprise') {
                  return StateController.runKiteEnterpriseAndWait(ATTEMPTS, INTERVAL)
                  .then(() => this.checkState())
                  .catch(err => console.error(err));
                }
              });
            } else if (kiteInstalled) {
              this.showErrorMessage('Kite is not running: Start the Kite background service to get Python completions, documentation, and examples.', 'Launch Kite').then(item => {
                if (item) {
                  return StateController.runKiteAndWait(ATTEMPTS, INTERVAL)
                  .then(() => this.checkState())
                  .catch(err => console.error(err));
                }
              });
            } else if (kiteEnterpriseInstalled) {
              this.showErrorMessage('Kite Enterprise is not running: Start the Kite background service to get Python completions, documentation, and examples.', 'Launch Kite Enterprise').then(item => {
                if (item) {
                  return StateController.runKiteEnterpriseAndWait(ATTEMPTS, INTERVAL)
                  .then(() => this.checkState())
                  .catch(err => console.error(err));
                }
              });
            }
          });
          break;
        case StateController.STATES.RUNNING:
          this.showErrorMessage('The Kite background service is running but not reachable.');
          break;
        case StateController.STATES.REACHABLE:
          this.setStatus(state);
          this.showErrorMessage('You need to login to the Kite engine', 'Login').then(item => {
            if (item) { 
              // opn('http://localhost:46624/settings'); 
              vscode.commands.executeCommand('vscode.previewHtml', 'kite-vscode-login://login', vscode.ViewColumn.Two, 'Kite Login');
            }
          });
          return Plan.queryPlan();
        default: 
          if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'python') {
            this.registerEditor(vscode.window.activeTextEditor);
          }
          return Plan.queryPlan()
      }
      this.setStatus(state);
    })
    .then(() => {
      this.updatePlan();
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

  updatePlan() {
    if (Plan.isEnterprise()) {
      this.statusBarItem.text = '$(primitive-dot) Kite Enterprise';
    } else if (Plan.isActivePro()) {
      let trialSuffix = '';

      if (Plan.isTrialing()) {
        const days = Plan.remainingTrialDays();
        trialSuffix = [
          ' (trial:',
          days,
          pluralize(days, 'day', 'days'),
          'left)',
        ].join(' ');
      }

      this.statusBarItem.text = `$(primitive-dot) Kite Pro${trialSuffix}`;
    } else {
      this.statusBarItem.text = '$(primitive-dot) Kite Basic';
    }
  },

  setStatus(state) {
    switch (state) {
      case StateController.STATES.UNSUPPORTED:
        this.statusBarItem.tooltip = 'Kite engine is currently not supported on your platform';
        this.statusBarItem.color = ERROR_COLOR;
        break;
      case StateController.STATES.UNINSTALLED:
        this.statusBarItem.tooltip = 'Kite engine is not installed';
        this.statusBarItem.color = ERROR_COLOR;
        break;
      case StateController.STATES.INSTALLED:
        this.statusBarItem.tooltip = 'Kite engine is not running';
        this.statusBarItem.color = ERROR_COLOR;
        break;
      case StateController.STATES.RUNNING:
        this.statusBarItem.tooltip = 'Kite engine is not reachable';
        this.statusBarItem.color = ERROR_COLOR;
        break;
      case StateController.STATES.REACHABLE:
        this.statusBarItem.color = WARNING_COLOR;
        break;
      case NOT_WHITELISTED: 
        this.statusBarItem.color = WARNING_COLOR;
        this.statusBarItem.tooltip = 'Current path is not whitelisted';
        break;
      default: 
        this.statusBarItem.color = undefined;
        this.statusBarItem.tooltip = 'Kite is ready';
    }
  },

  isGrammarSupported(e) {
    return e && e.document.languageId === 'python';
  },

  isEditorWhitelisted(e) {
    const ke = this.kiteEditorByEditor.get(e);
    return ke && ke.isWhitelisted();
  },

  handle403Response(document, resp) {
    // for the moment a 404 response is sent for non-whitelisted file by
    // the tokens endpoint
    editorsForDocument(document).forEach(e => {
      const ke = this.kiteEditorByEditor.get(e);
      if (ke) { ke.whitelisted = resp.statusCode !== 403 }
    });

    if (resp.statusCode === 403) {
      this.setStatus(NOT_WHITELISTED);
      this.shouldOfferWhitelist(document)
      .then(res => { if (res) { this.warnNotWhitelisted(document, res); }})
      .catch(err => console.error(err));
    } else {
      this.setStatus(StateController.STATES.WHITELISTED);
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
    this.shownNotifications = this.shownNotifications || {};

    if (!this.shownNotifications['whitelist']) {
      this.shownNotifications['whitelist'] = true;
      vscode.window.showErrorMessage(
        `The Kite engine is disabled for ${document.fileName}`,
        `Whitelist ${res}`
      ).then(item => {
        delete this.shownNotifications['whitelist'];
        return item 
          ? StateController.whitelistPath(res)
            .then(() => Logger.debug('whitelisted'))
          : StateController.blacklistPath(res)
            .then(() => Logger.debug('blacklisted'));
      });
    } else {
      return Promise.resolve();
    }
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