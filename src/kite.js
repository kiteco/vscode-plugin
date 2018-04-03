'use strict';

const vscode = require('vscode');
const os = require('os');
const opn = require('opn');
const {StateController, AccountManager, Logger} = require('kite-installer');
const {PYTHON_MODE, JAVASCRIPT_MODE, ATTEMPTS, INTERVAL, ERROR_COLOR, WARNING_COLOR, SUPPORTED_EXTENSIONS} = require('./constants');
const KiteHoverProvider = require('./hover');
const KiteCompletionProvider = require('./completion');
const KiteSignatureProvider = require('./signature');
const KiteDefinitionProvider = require('./definition');
const KiteRouter = require('./router');
const KiteSearch = require('./search');
const KiteLogin = require('./login');
const KiteInstall = require('./install');
const KiteStatus = require('./status');
const KiteTour = require('./tour');
const KiteEditor = require('./kite-editor');
const EditorEvents = require('./events');
const localconfig = require('./localconfig');
const metrics = require('./metrics');
const Plan = require('./plan');
const server = require('./server');
const {openDocumentationInWebURL, projectDirPath, shouldNotifyPath, statusPath, languagesPath, hoverPath} = require('./urls');
const Rollbar = require('rollbar');
const {editorsForDocument, promisifyRequest, promisifyReadResponse, compact, params} = require('./utils');
const {version} = require('../package.json');

const pluralize = (n, singular, plural) => n === 1 ? singular : plural;

const Kite = {
  activate(ctx) 
  {
    if(process.env.NODE_ENV === 'test') { return; }

    const rollbar = new Rollbar({
      accessToken: '4ca1bfd4721544e487c76583478a436a',
      payload: {
        environment: process.env.NODE_ENV,
        editor: 'vscode',
        kite_plugin_version: version,
        os: os.type() + ' ' + os.release(),
      },
    });

    process.on('uncaughtException', function (err) {
      if (err.stack.indexOf('kite') > -1) {
        rollbar.error(err);
      }
    });

    this.kiteEditorByEditor = new Map();
    this.eventsByEditor = new Map();
    this.supportedLanguages = [];
    this.shown = {};

    const router = new KiteRouter(Kite);
    const search = new KiteSearch(Kite);
    const login = new KiteLogin(Kite);
    const install = new KiteInstall(Kite);
    const status = new KiteStatus(Kite);
    const tour = new KiteTour(Kite);

    Logger.LEVEL = Logger.LEVELS[vscode.workspace.getConfiguration('kite').loggingLevel.toUpperCase()];

    // send the activated event
    metrics.track('activated');

    AccountManager.initClient(
      StateController.client.hostname,
      StateController.client.port,
      ''
    );

    ctx.subscriptions.push(server);
    ctx.subscriptions.push(router);
    ctx.subscriptions.push(search);
    ctx.subscriptions.push(status);
    ctx.subscriptions.push(install);

    this.status = status;
    this.install = install;

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
    
    ctx.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('kite-vscode-sidebar', router));
    ctx.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('kite-vscode-search', search));
    ctx.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('kite-vscode-login', login));
    ctx.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('kite-vscode-install', install));
    ctx.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('kite-vscode-status', status));
    ctx.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('kite-vscode-tour', tour));

    ctx.subscriptions.push(
      vscode.languages.registerHoverProvider(PYTHON_MODE, new KiteHoverProvider(Kite)));
    ctx.subscriptions.push(
      vscode.languages.registerDefinitionProvider(PYTHON_MODE, new KiteDefinitionProvider(Kite)));
    ctx.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(PYTHON_MODE, new KiteCompletionProvider(Kite), '.'));
    ctx.subscriptions.push(
      vscode.languages.registerSignatureHelpProvider(PYTHON_MODE, new KiteSignatureProvider(Kite), '(', ','));
    
    ctx.subscriptions.push(
      vscode.languages.registerHoverProvider(JAVASCRIPT_MODE, new KiteHoverProvider(Kite)));
    ctx.subscriptions.push(
      vscode.languages.registerDefinitionProvider(JAVASCRIPT_MODE, new KiteDefinitionProvider(Kite)));
    ctx.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(JAVASCRIPT_MODE, new KiteCompletionProvider(Kite), '.'));
    ctx.subscriptions.push(
      vscode.languages.registerSignatureHelpProvider(JAVASCRIPT_MODE, new KiteSignatureProvider(Kite), '(', ','));

    ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
      Logger.LEVEL = Logger.LEVELS[vscode.workspace.getConfiguration('kite').loggingLevel.toUpperCase()];
    }));

    ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {      
      if (e) {
        if (/Code[\/\\]User[\/\\]settings.json$/.test(e.document.fileName)){
          metrics.featureRequested('settings');
          metrics.featureFulfilled('settings');
        }
        if (this.isGrammarSupported(e)) { 
          this.registerEvents(e);
          this.registerEditor(e); 
        }
  
        const evt = this.eventsByEditor.get(e);
        evt.focus();
      }
    }));

    ctx.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e => {
      const evt = this.eventsByEditor.get(e.textEditor);
      evt.selectionChanged();
      this.setStatusBarLabel();
    }));

    ctx.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
      e.document && editorsForDocument(e.document).forEach(e => {
        const evt = this.eventsByEditor.get(e);
        evt.edit();
      })
    }));

    ctx.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
      if (doc.languageId === 'python') {
        this.registerDocumentEvents(doc);
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
      metrics.featureRequested('status_panel');
      vscode.commands.executeCommand('vscode.previewHtml', 'kite-vscode-status://status', vscode.ViewColumn.Two, 'Kite Status');
    });

    vscode.commands.registerCommand('kite.search', () => {
      search.clearCache();
      vscode.commands.executeCommand('vscode.previewHtml', 'kite-vscode-search://search', vscode.ViewColumn.Two, 'Kite Search');
    }); 
    
    vscode.commands.registerCommand('kite.reset-search-history', () => {
      localconfig.set('searchHistory', []);
    }); 
    
    vscode.commands.registerCommand('kite.login', () => {
      vscode.commands.executeCommand('vscode.previewHtml', 'kite-vscode-login://login', vscode.ViewColumn.Two, 'Kite Login');
    }); 
    
    vscode.commands.registerCommand('kite.install', () => {
      install.reset();
      AccountManager.initClient('alpha.kite.com', -1, true);
      vscode.commands.executeCommand('vscode.previewHtml', 'kite-vscode-install://install', vscode.ViewColumn.One, 'Kite Install');
    }); 

    vscode.commands.registerCommand('kite.open-settings', () => {
      opn('http://localhost:46624/settings');
    });

    vscode.commands.registerCommand('kite.open-permissions', () => {
      opn('http://localhost:46624/settings/permissions');
    });

    vscode.commands.registerCommand('kite.more', ({id, source}) => {
      metrics.track(`${source} See info clicked`);
      metrics.featureRequested('expand_panel');
      metrics.featureRequested('documentation');
      server.start();
      const uri = `kite-vscode-sidebar://value/${id}`;
      router.clearNavigation();
      router.navigate(uri, `
        window.onload = () => {
          window.requestGet('/count?metric=fulfilled&name=expand_panel');
          if(document.querySelector('.summary .description:not(:empty)')) {
            window.requestGet('/count?metric=fulfilled&name=documentation');
          }
        }
      `);
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
      metrics.featureRequested('expand_panel');
      metrics.featureRequested('documentation');
      server.start();
      const uri = `kite-vscode-sidebar://value-range/${JSON.stringify(range)}`;
      router.clearNavigation();
      router.navigate(uri, `
        window.onload = () => {
          window.requestGet('/count?metric=fulfilled&name=expand_panel');
          if(document.querySelector('.summary .description:not(:empty)')) {
            window.requestGet('/count?metric=fulfilled&name=documentation');
          }
        }
      `);
    });

    vscode.commands.registerCommand('kite.more-position', ({position, source}) => {
      metrics.track(`${source} See info clicked`);
      metrics.featureRequested('expand_panel');
      metrics.featureRequested('documentation');
      server.start();
      const uri = `kite-vscode-sidebar://value-position/${JSON.stringify(position)}`;
      router.clearNavigation();
      router.navigate(uri, `
        window.onload = () => {
          window.requestGet('/count?metric=fulfilled&name=expand_panel');
          if(document.querySelector('.summary .description:not(:empty)')) {
            window.requestGet('/count?metric=fulfilled&name=documentation');
          }
        }
      `);
    });

    vscode.commands.registerCommand('kite.navigate', (path) => {
      const uri = `kite-vscode-sidebar://${path}`;
      router.chopNavigation();
      router.navigate(uri);
    });
    
    vscode.commands.registerCommand('kite.web', ({id, source}) => {
      metrics.track(`${source} Open in web clicked`);
      metrics.featureRequested('open_in_web');
      metrics.featureFulfilled('open_in_web');
      opn(openDocumentationInWebURL(id));
    });

    vscode.commands.registerCommand('kite.web-url', (url) => {
      metrics.track(`Open in web clicked`);
      opn(url.replace(/;/g, '%3B'));
    });

    vscode.commands.registerCommand('kite.def', ({file, line, source}) => {
      metrics.track(`${source} Go to definition clicked`);
      metrics.featureRequested('definition');
      vscode.workspace.openTextDocument(vscode.Uri.file(file))
      .then(doc => {
        return vscode.window.showTextDocument(doc);
      })
      .then(e => {
        metrics.featureFulfilled('definition');
        e.revealRange(new vscode.Range(
          new vscode.Position(line - 1, 0),
          new vscode.Position(line - 1, 100)
        ));
      })
    });

    vscode.commands.registerCommand('kite.help', () => {
      vscode.commands.executeCommand('vscode.previewHtml', 'kite-vscode-tour://tour', vscode.ViewColumn.One, 'Kite Tour');
    });

    vscode.commands.registerCommand('kite.docs-for-cursor', () => {
      const editor = vscode.window.activeTextEditor;

      if (editor && this.isGrammarSupported(editor)) {
        const pos = editor.selection.active;
        const {document} = editor;

        const path = hoverPath(document, pos)
        StateController.client.request({path})
          .then(resp => {
            if(resp.statusCode === 200) {
              vscode.commands.executeCommand('kite.more-position', {
                position: pos,
                source: 'Command',
              })
            }
          })
      }
    });

    vscode.commands.registerCommand('kite.usage', ({file, line, source}) => {
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
    });

    const config = vscode.workspace.getConfiguration('kite');
    if (config.showDocsNotificationOnStartup) {
      vscode.window.showInformationMessage('Kite is now integrated with VS Code', 'Learn how to use Kite', "Don't show this again").then(item => {
        if (item) { 
          switch(item) {
            case 'Learn how to use Kite':
              opn('http://help.kite.com/category/46-vs-code-integration');
              break;
            case "Don't show this again":
              config.update('showDocsNotificationOnStartup', false, true);
              break;
          }
        }
      });
    }

    if (config.editorMetricsEnabled === 'undefined') {
      vscode.window.showInformationMessage(
        `Allow Kite to send information to our servers about the status of the Kite application`,
        `Yes`,
        `No`
      ).then(item => {
        if (item) {
          config.update('editorMetricsEnabled', item.toLowerCase(), true);
        }
      });
    }

    setTimeout(() => {
      vscode.window.visibleTextEditors.forEach(e => {
        if (e.document.languageId === 'python') {
          this.registerEvents(e);
          this.registerEditor(e);
        }
      })

      this.checkState('activationCheck');
    }, 100);

    this.pollingInterval = setInterval(() => {
      this.checkState('pollingInterval');
    }, config.get('pollingInterval') || 5000);

    // We monitor kited health
    setInterval(checkHealth, 60 * 1000 * 10);
    checkHealth();

    function checkHealth() {
      StateController.handleState().then(state => {
        switch (state) {
          case 0: return metrics.trackHealth('unsupported');
          case 1: return metrics.trackHealth('uninstalled');
          case 2: return metrics.trackHealth('installed');
          case 3: return metrics.trackHealth('running');
          case 4: return metrics.trackHealth('reachable');
          case 5: return metrics.trackHealth('authenticated');
        }
      });
    }
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
    if (e && !this.eventsByEditor.has(e) && e.document) {
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

  checkState(src) {
    return Promise.all([
      StateController.handleState(),
      this.getSupportedLanguages().catch(() => []),
    ]).then(([state, languages]) => {
      this.supportedLanguages = languages;
      
      if (state > StateController.STATES.INSTALLED) {
        localconfig.set('wasInstalled', true);
      }

      switch (state) {
        case StateController.STATES.UNSUPPORTED:
          if (this.shown[state] || !this.isGrammarSupported(vscode.window.activeTextEditor)) { return state; }
          this.shown[state] = true;
          if (!StateController.isOSSupported()) {
            metrics.track('OS unsupported');
          } else if (!StateController.isOSVersionSupported()) {
            metrics.track('OS version unsupported');
          }
          this.showErrorMessage('Sorry, the Kite engine is currently not supported on your platform');
          break;
        case StateController.STATES.UNINSTALLED:
          if (this.shown[state] || !this.isGrammarSupported(vscode.window.activeTextEditor)) { return state; }
          this.shown[state] = true;
          if (!localconfig.get('wasInstalled', false)) {
            this.install.reset();
            AccountManager.initClient('alpha.kite.com', -1, true);
            vscode.commands.executeCommand('vscode.previewHtml', 'kite-vscode-install://install', vscode.ViewColumn.One, 'Kite Install');
          }
          break;
        case StateController.STATES.INSTALLED:
          break;
        case StateController.STATES.RUNNING:
          if (this.shown[state] || !this.isGrammarSupported(vscode.window.activeTextEditor)) { return state; }
          //An imperfect safeguard against showing a false positive error notification generated by
          //kited restart race condition
          if(this.lastPolledState && this.lastPolledState === StateController.STATES.RUNNING){
            this.shown[state] = true;
            this.showErrorMessage('The Kite background service is running but not reachable.');
          }
          break;
        case StateController.STATES.REACHABLE:
          if (this.shown[state] || !this.isGrammarSupported(vscode.window.activeTextEditor)) { return state; }
          //An imperfect safeguard against showing a false positive error notification generated by
          //kited restart race condition
          if(this.lastPolledState && this.lastPolledState === StateController.STATES.REACHABLE) {
            this.shown[state] = true;
            this.setStatus(state);
            this.checkConnectivity().then(() => {
              this.showErrorMessage('You need to login to the Kite engine', 'Login').then(item => {
                if (item) { 
                  // opn('http://localhost:46624/settings'); 
                  vscode.commands.executeCommand('vscode.previewHtml', 'kite-vscode-login://login', vscode.ViewColumn.Two, 'Kite Login');
                }
              });
            })
          }
          if(src && (src === 'pollingInterval' || src === 'activationCheck')) this.lastPolledState = state
          return Plan.queryPlan().then(() => state);
        default: 
          if (this.isGrammarSupported(vscode.window.activeTextEditor)) {
            this.registerEditor(vscode.window.activeTextEditor);
          }
          if(src && (src === 'pollingInterval' || src === 'activationCheck')) this.lastPolledState = state
          return Plan.queryPlan().then(() => state)
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

    const statusLabelPromise = this.getDocsAvailabilityLabel(state, status);
    
    statusLabelPromise.then(label => {
      this.statusBarItem.text = compact(['$(primitive-dot) Kite', label]).join(': ')
    
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
        default: 
          switch(status.status) {
            case 'not whitelisted':
              this.statusBarItem.color = WARNING_COLOR;
              this.statusBarItem.tooltip = 'Current path is not whitelisted';
              break;
            case 'indexing':
              this.statusBarItem.color = undefined;
              this.statusBarItem.tooltip = 'Kite engine is indexing your code';
              break;
            case 'syncing':
              this.statusBarItem.color = undefined;
              this.statusBarItem.tooltip = 'Kite engine is syncing your code';
              break;
            case 'blacklisted': 
            case 'ignored': 
              this.statusBarItem.color = undefined;
              this.statusBarItem.tooltip = 'Current path is ignored by Kite';
              break;
            case 'ready': 
              this.statusBarItem.color = undefined;
              this.statusBarItem.tooltip = 'Kite is ready';
              break;
          }
      }
    })
  },

  getDocsAvailabilityLabel(state, status) {
    let statusLabel = 'ready';
    let hoverPromise;
    switch(state) {
      case StateController.STATES.UNINSTALLED:
        statusLabel = 'not installed';
        break;
      case StateController.STATES.INSTALLED:
        statusLabel = 'not running';
        break;
      case StateController.STATES.REACHABLE:
        statusLabel = 'not logged in';
        break;
      default:
        if(status) {
          switch(status.status) {
            case 'indexing':
              statusLabel = 'indexing';
              break;
            case 'syncing':
              statusLabel = 'syncing';
              break;
            case 'not whitelisted':
            case 'blacklisted':
            case 'ignored':
              break;
            default:
              const editor = vscode.window.activeTextEditor;
              if (editor) {
                const path = hoverPath(editor.document, editor.selection.active);
                hoverPromise = StateController.client.request({path})
                  .then(resp => {
                    if(resp.statusCode === 200) {
                      return 'Docs available at cursor';
                    } else {
                      return 'ready';
                    }
                  }).catch(() => 'ready');
              }
              break;
          }
        }
    }
    if(hoverPromise) { return hoverPromise; }
    return Promise.resolve(statusLabel);
  },

  setStatus(state = this.lastState, document) {
    this.lastState = state;
    this.status.update();
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
      // this.setStatus(NOT_WHITELISTED, document);
      this.shouldOfferWhitelist(document)
      .then(res => { if (res) { this.warnNotWhitelisted(document, res); }})
      .catch(err => console.error(err));
    } else {
      this.setStatus(StateController.STATES.WHITELISTED, document);
    }
  },

  getStatus(document) {
    if (!document) { return Promise.resolve({status: 'ready'}); }

    const path = statusPath(document.fileName);

    return StateController.client.request({path}, null, document)
    .then(resp => {
      if (resp.statusCode === 200) {
        return promisifyReadResponse(resp).then(json => JSON.parse(json));
      } else if (resp.statusCode === 403) {
        return {status: 'not whitelisted'}
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
          : StateController.blacklistPath(document.fileName)
            .then(() => Logger.debug('blacklisted'));
      });
    } else {
      return Promise.resolve();
    }
  },

  projectDirForEditor(document) {
    const filepath = document.fileName;
    const path = projectDirPath(filepath);

    return StateController.client.request({path})
    .then(resp => {
      if (resp.statusCode === 200) {
        return promisifyReadResponse(resp)
      } else if (resp.statusCode === 403) {
        return null;
      } else if (resp.statusCode === 404) {
        return (
          vscode.workspace.workspaceFolders 
            ? vscode.workspace.workspaceFolders[0].uri.fsPath 
            : vscode.workspace.rootPath
        ) || os.homedir();
      } else {
        throw new Error('Invalid status');
      }
    });
  },

  shouldNotify(document) {
    const filepath = document.fileName;
    const path = shouldNotifyPath(filepath);

    return StateController.client.request({path})
    .then(resp => resp.statusCode === 200)
    .catch(() => false);
  },

  request(req, data, document) {
    return promisifyRequest(StateController.client.request(req, data))
    .then(resp => {
      if (this.isDocumentGrammarSupported(document)) {
        this.handle403Response(document, resp);
      }
      
      // Logger.logResponse(resp);
      
      if (resp.statusCode !== 200) {
        return promisifyReadResponse(resp).then(data => {
          const err = new Error(`bad status ${resp.statusCode}: ${data}`);
          err.status = resp.statusCode;
          throw err;
        })
      }
      return promisifyReadResponse(resp);
    })
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
  }
}

module.exports = {
  activate(ctx) { Kite.activate(ctx); },
  deactivate() { Kite.deactivate(); },
  request(...args) { return Kite.request(...args); }
}