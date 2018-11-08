'use strict';

const os = require('os');
const vscode = require('vscode');
const {workspace} = vscode;
const formidable = require('formidable');
const {wrapHTML, debugHTML, logo, spinner} = require('./html-utils');

const {
  install: {
    Authenticate,
    BranchStep,
    CheckEmail,
    CreateAccount,
    Download,
    Flow,
    GetEmail,
    InputEmail,
    Install,
    Login,
    ParallelSteps,
    VoidStep,
  }
} = require('kite-installer');

const URI = vscode.Uri.parse('kite-vscode-install://install');
const screenshot = '';
let Kite;

module.exports = class KiteInstall {
  constructor(K) {
    Kite = K;
  }

  update() {
    this.getHTML()
    .then(html => {
      if(this.currentPanel) {
        this.currentPanel.webview.html = html;
      }
    })
    .catch(err => {
      console.log(err);
    });
  }

  dispose() {}
  
  reset() {
    delete this.installFlow;
    delete this.lastView;
  }

  show() {
    const columnToShowIn = vscode.ViewColumn.One;

    if(this.currentPanel) {
      this.currentPanel.reveal(columnToShowIn);
    } else {
      this.currentPanel = vscode.window.createWebviewPanel('kite-install', "Kite Install", columnToShowIn, {
        enableScripts: true,
      });
  
      this.currentPanel.webview.onDidReceiveMessage(message => {
        switch (message.command) {
          case 'count':
            const {metric, name} = message;
            if (metric === 'requested') {
              metrics.featureRequested(name);
            } else if (metric === 'fulfilled') {
              metrics.featureFulfilled(name);
            }
            return;
          case 'reload': 
            return this.update();
          case 'command': 
            vscode.commands.executeCommand(message.name, ...(message.args || []));
            return;
          case 'event':
            const event = message.event;
            delete message.command;
            delete message.event;
        
            this.installFlow.emit(event, message);
            return;
        }
      });
      
      // Reset when the current panel is closed
      this.currentPanel.onDidDispose(() => {
        delete this.currentPanel;
      });
    }
    
    this.update();
  }

  getHTML() {
    if (!this.installFlow) {
      this.installFlow = this.flow();
      this.installFlow.observeState(state => {
        if (!state.download || state.download.done) {
          this.update();
        } else {
          if (state.download.ratio) {
            this.currentPanel.webview.postMessage({
              command: 'progress', 
              ratio: state.download.ratio
            });
          }
        }
      });
      this.installFlow.onDidChangeCurrentStep(step => {
        this.update()
      });

      setTimeout(() => {
        this.installFlow.start()
        .then(res => console.log(res))
        .catch(err => console.log(err));
      }, 500);
    }
    const view = this.installFlow.getCurrentStepView() || this.lastView;
    const {state} = this.installFlow;

    const persistingView = view === this.lastView && !state.error && view !== whitelistView;

    this.lastView = view;

    return Promise.resolve(`
    <div class="install">
      <header>
        <div class="logo">${logo}</div>
        <div class="progress-indicators">
          <div class="download-kite ${state.download && !state.download.done ? '' : 'hidden'}">
            <progress max='100'
                      value="${state.download ? Math.round(state.download.ratio * 100) : 0}"></progress>
            <span>Downloading Kite</span>
          </div>
          <div class="install-kite ${state.install && !state.install.done ? '' : 'hidden'}">
            ${spinner}
            <span class="inline-block">Installing Kite</span>
          </div>
          <div class="run-kite ${state.running && view !== installEndView ? '' : 'hidden'}">
            ${spinner}
            <span class="inline-block">Starting Kite</span>
          </div>
        </div>
        <div class="status ${state.error ? 'text-danger' : 'hidden'}">${state.error ? getErrorMessage(state.error) : ''}</div>
      </header>
      <div class="content ${persistingView ? 'disabled' : ''}">${view ? view(this.installFlow.state) : 'install'}</div>
    </div>`)
    .then(html => wrapHTML(html))
    .then(html => debugHTML(html))
  }

  flow() {
    return new Install([
      new GetEmail({name: 'get-email'}),
      new InputEmail({
        name: 'input-email',
        view: inputEmailView,
      }),
      new CheckEmail({
        name: 'check-email',
        failureStep: 'input-email',
      }),
      new BranchStep([
        {
          match: (data) => data.account.exists,
          step: new Login({
            name: 'login',
            view: loginView,
            failureStep: 'account-switch',
            backStep: 'input-email',
          }),
        }, {
          match: (data) => !data.account.exists,
          step: new CreateAccount({name: 'create-account'}),
        },
      ], {
        name: 'account-switch',
      }),
      new Flow([
        new Download({name: 'download', view: installWaitView}),
        new Authenticate({name: 'authenticate'}),
      ], {
        name: 'download-flow', 
      }),
      new BranchStep([
        {
          match: (data) => !data.error,
          step: new VoidStep({
            name: 'end',
            view: installEndView,
          }),
        }, {
          match: (data) => data.error,
          step: new VoidStep({
            name: 'error',
            view: installErrorView,
          }),
        },
      ], {name: 'termination'}),
    ], {
      path: (workspace.workspaceFolders ? workspace.workspaceFolders[0].uri.fsPath : workspace.rootPath) || os.homedir()
    }, {
      failureStep: 'termination',
      title: 'Kite Install',
    });
  }
}

function inputEmailView (state) {
  return `
  <p>To install Kite, first create an account with your email address.</p>

  <form novalidate
        method="POST">
    <input class="input-text"
            name="email"
            type="email"
            placeholder="enter your email"
            value="${state.account ? state.account.email || '' : ''}"></input>
    <button class="btn btn-primary btn-block"
            onclick="return submitEvent('did-submit-email')">Continue</button>
  </form>`;
}

function loginView(state) {
  return `
  <p>It seems like you already have a Kite account. Sign in with your login info.</p>

  <form novalidate
        method="POST">
    <input class='input-text'
            name="email"
            type="email"
              value="${state.account ? state.account.email || '' : ''}"></input>
    <input class='input-text'
            name="password"
            type="password"
            placeholder="password"
            value="${state.account ? state.account.password || '' : ''}"></input>
    <button class="btn btn-primary btn-block"
            onclick="return submitEvent('did-submit-credentials')">Sign in</button>
    <div class="secondary-actions">
      <a class="back"
          href="#"
          onclick="return submitEvent('did-click-back')">Back</a>
      <a class="reset-password secondary-cta"
          href="#"
          onclick="return submitEvent('did-forgot-password')">Forgot password</a>
    </div>
  </form>`;
}
function whitelistView(state) {
  return `
  <p class="email ${state.account.hasPassword ? 'hidden' : ''}">
    Great we've sent you an email to ${state.account.email}.
    Remember to set your password later!
  </p>
  <p class="text-highlight">
    Kite is a cloud-powered programming tool.
    Where enabled, your code is sent to our cloud,
    where it is kept private and secure.
  </p>
  <p>
    This lets Kite show completions, documentation, examples and more.
  </p>
  <p>
    You can restrict access to individual files or entire directories
    at any time. You can also remove unwanted data from the cloud freely.
  </p>
  
  <p><strong><a href="http://help.kite.com/category/30-security-privacy" class="no-disable">Click here to learn more</a></strong></p>

  <form novalidate
        action="/install/emit"
        method="POST">
    <input type="hidden" name="event"></input>
    <div class="actions ${state.whitelist ? 'disabled' : ''}">
      <button class="btn btn-primary"
              onclick="document.querySelector('.content').classList.add('disabled'); return submitEvent('did-whitelist')">Enable access for ${state.path}</button>
      <a class="skip secondary-cta"
         href="#"
         onclick="document.querySelector('.content').classList.add('disabled'); return submitEvent('did-skip-whitelist')">Add Later</a>
    </div>
  </form>

  <script>initDownloadProgress();</script>`;
}

function installWaitView() {
  return `<div class="welcome-to-kite">
      <div class="warning">
        <span class="icon">⚠️</span>
        <span class="message">Kite is still installing on your machine. Please do not close this tab until installation has finished.</span>
      </div>
      <div class="description">
        <div class="content">
          <p>Kite provides the best Python completions in the world</p>
          <ul>
            <li>1.5x more completions than the basic engine</li>
            <li>Completions ranked by popularity</li>
            <li>2x documentation coverage</li>
          </ul>
        </div>
        <div class="description-screenshot"><img src="${screenshot}"></div>
      </div>
      <p>
        Kite is under active development. You can expect our completions
        to improve significantly and become more intelligent over the coming
        months.</p>
      <p class="feedback">Send us feedback at <a href="mailto:feedback@kite.com">feedback@kite.com</a></p>
    </div>`;
}
function installEndView(state) {
  return `
  <div class="welcome-to-kite">
    <div class="welcome-title">
      <h3>Welcome to Kite!</h3>
    </div>
    <div class="description">
      <div class="content">
        <p>Kite is still indexing your Python code. You can start coding now and you’ll see your completions improve over the next few minutes.</p>
        <p><strong>Kite provides the best Python completions in the world.</strong></p>
        <ul>
          <li>1.5x more completions than local engine</li>
          <li>Completions ranked by popularity</li>
          <li>2x documentation coverage</li>
        </ul>
      </div>
      <!--<div class="description-screenshot"><img src="${screenshot}"></div>-->
    </div>
    <p>
      Kite is under active development. Expect many new features
      in the coming months, including formatted documentation,
      jump to definition, function call signatures, and many more</p>
    <p class="feedback">Send us feedback at <a href="mailto:feedback@kite.com">feedback@kite.com</a></p>
  </div>`;
}
function installErrorView(state) {
  return `<div class="status">
    <h4>${getErrorMessage(state.error)}</h4>
    <pre>${state.error.stack}</pre>
  </div>`;
}

function getErrorMessage(error) {
  switch (error.message) {
    case 'bad_state 2': 
      return 'Kite is already installed';
    case 'bad_state 3': 
      return 'Kite is already running';
    default: 
      return error.message;
  }
}
