'use strict';

const os = require('os');
const vscode = require('vscode');
const {workspace} = vscode;
const formidable = require('formidable');
const server = require('../server');
const {wrapHTML, debugHTML, logo, spinner} = require('../html-utils');
const {promisifyReadResponse} = require('../utils');
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
    Whitelist,
    WhitelistChoice,
  }
} =  require('kite-installer');
const URI = 'kite-vscode-install://install';

let instance;

server.addRoute('POST', '/install/emit', (req, res, url) => {
  const form = new formidable.IncomingForm();

  form.parse(req, (err, fields) => {
    if (err) {
      res.writeHead(500, {'Content-Type': 'text/plain'});
      return res.end(err.stack);
    }
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('');

    const event = fields.event;
    delete fields.event;

    instance.installFlow.emit(event, fields);
  });
});

server.addRoute('GET', '/install/progress', (req, res, url) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(instance &&
          instance.installFlow &&
          instance.installFlow.state &&
          instance.installFlow.state.download
    ? String(instance.installFlow.state.download.ratio)
    : '-1');
})

function inputEmailView (state) {
  return `
  <p>To install Kite, first create an account with your email address.</p>

  <form novalidate
        action="http://localhost:${server.PORT}/install/emit"
        method="POST">
    <input type="hidden" name="event"></input>
    <input class="input-text"
            name="email"
            type="email"
            placeholder="enter your email"
            value="${state.account ? state.account.email || '' : ''}"></input>
    <button class="btn btn-primary btn-block"
            onclick="return submitEvent('did-submit-email')"">Continue</button>
  </form>`;
}
function loginView(state) {
  return `
  <p>It seems like you already have a Kite account. Sign in with your login info.</p>

  <form novalidate
        action="http://localhost:${server.PORT}/install/emit"
        method="POST">
    <input type="hidden" name="event"></input>
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
        action="http://localhost:${server.PORT}/install/emit"
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
function installEndView(state) {
  return `
  <div class="welcome-to-kite">
    <div class="welcome-title">
      <h3>Welcome to Kite!</h3>
    </div>
    <div class="warning">
      Kite is still indexing some of your Python code. You\’ll see your completions improve over the next few minutes.
    </div>
    <div class="description">
      <div class="content">
        <p>You\'ll see Kite completions when writing Python in any Kite-enabled directory.</p>
        <p><strong>Kite provides the best Python completions in the world.</strong></p>
        <ul>
          <li>1.5x more completions than local engine</li>
          <li>Completions ranked by popularity</li>
          <li>2x documentation coverage</li>
        </ul>
      </div>
      <!--<div class="description-screenshot"><img src="$\{screenshot\}"></div>-->
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

module.exports = class KiteInstall {
  constructor(Kite) {
    this.Kite = Kite;
    this.didChangeEmitter = new vscode.EventEmitter();
    instance = this;
  }

  get onDidChange() {
    return this.didChangeEmitter.event;
  }

  update() {
    this.didChangeEmitter.fire(URI);
  }

  dispose() {}

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
      new ParallelSteps([
        new Flow([
          new Download({name: 'download'}),
          new Authenticate({name: 'authenticate'}),
        ], {name: 'download-flow'}),
        new WhitelistChoice({
          name: 'whitelist-choice',
          view: whitelistView,
        }),
      ], {
        name: 'download-and-whitelist',
      }),
      new Whitelist({name: 'whitelist'}),
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

  provideTextDocumentContent() {
    if (!this.installFlow) {
      server.start();

      this.installFlow = this.flow();
      this.installFlow.observeState(state => {
        if (!state.download || state.download.done) {
          this.update();
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
}
