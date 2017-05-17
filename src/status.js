'use strict';

const vscode = require('vscode');
const {StateController, Logger} = require('kite-installer');
const server = require('./server');
const {wrapHTML, debugHTML, proLogoSvg, logo, pluralize} = require('./html-utils');
const Plan = require('./plan');
const {accountPath, statusPath} = require('./urls');
const {promisifyRequest, promisifyReadResponse, params} = require('./utils');
const {MAX_FILE_SIZE} = require('./constants');
const {STATES} = StateController;
const dot = '<span class="dot">•</span>';

server.addRoute('GET', '/status/start', (req, res, url) => {
  StateController.runKiteAndWait()
  .then(() => {
    res.writeHead(200),
    res.end();
  })
  .catch(() => {
    res.writeHead(500);
    res.end();
  });
});

server.addRoute('GET', '/status/whitelist', (req, res, url) => {
  const dirpath = params(url).dirpath;
  StateController.whitelistPath(dirpath)
  .then(() => {
    res.writeHead(200),
    res.end();
  })
  .catch(() => {
    res.writeHead(500);
    res.end();
  });
});

module.exports = class KiteStatus {
  constructor(Kite) {
    this.Kite = Kite;
    this.didChangeEmitter = new vscode.EventEmitter();

    server.addRoute('GET', '/status/reload', (req, res, url) => {
      res.writeHead(200);
      res.end();

      this.update();
    });
  }

  get onDidChange() { 
    return this.didChangeEmitter.event; 
  }

  update() {
    this.didChangeEmitter.fire('kite-vscode-status://status');
  }

  dispose() {}

  provideTextDocumentContent() {
    server.start();

    return this.renderCurrent()
    .then(html => `
      <div class="kite-status-panel">${html}</div>
      <script>
        window.PORT = ${server.PORT};
      </script>
    `)
    .then(html => wrapHTML(html))
    .then(html => debugHTML(html));
  }

  getUserAccountInfo() {
    const path = accountPath();

    return promisifyRequest(StateController.client.request({path}))
      .then(resp => {
        Logger.logResponse(resp);
        if (resp.statusCode !== 200) {
          throw new Error(`${resp.statusCode} at ${path}`);
        }
        return promisifyReadResponse(resp);
      })
      .then(account => JSON.parse(account));
  }

  getStatus(editor) {
    if (!editor) { return Promise.resolve(null); }

    const filepath = editor.document.fileName;
    const path = statusPath(filepath);

    return promisifyRequest(StateController.client.request({path}))
    .then(resp => {
      Logger.logResponse(resp);
      if (resp.statusCode === 200) {
        return promisifyReadResponse(resp)
        .then(json => JSON.parse(json))
        .catch(() => null);
      }
      return null;
    })
    .catch(() => null);
  }

  renderCurrent() {
    const editor = vscode.window.activeTextEditor;
    const promises = [
      Plan.queryPlan().catch(() => null),
      StateController.handleState(),
      this.getUserAccountInfo().catch(() => ({})),
      this.getStatus(editor),
    ];
    if (this.Kite.isGrammarSupported(editor)) {
      promises.push(this.Kite.projectDirForEditor(editor.document).catch(() => null));
    }

    return Promise.all(promises).then(data => this.render(...data));
  }

  render(plan, status, account, syncStatus, projectDir) {
    return `
      ${this.renderSubscription(plan, status)}
      ${this.renderEmailWarning(account)}
      ${this.renderLinks()}
      ${this.renderStatus(status, syncStatus, projectDir)}
    `;
  }

  renderLinks() {
    let giftLink = '';

    if (!Plan.isActivePro()) {
      if (Plan.referralsCredited() &&
          Plan.referralsCredited() < Plan.referralsCredits()) {
        giftLink = `<li>
          <a is="kite-localtoken-anchor"
             href="http://localhost:46624/redirect/invite"
             class="kite-gift">Get free Pro! <i class="icon-kite-gift"></i></a>
        </li>`;
      } else {
        giftLink = `<li>
          <a is="kite-localtoken-anchor"
             href="http://localhost:46624/redirect/invite"
             class="kite-gift">Invite friends <i class="icon-kite-gift"></i></a>
        </li>`;
      }
    }

    return `
    <ul class="links">
      ${giftLink}
      <li><a href="https://ga.kite.com/docs/">Search Python documentation</a></li>
      <li><a href='command:kite.web-url?"http://localhost:46624/settings"'>Settings</a></li>
      <li><a href='command:kite.web-url?"http://localhost:46624/settings/permissions"'>Permissions</a></li>
      <li><a href="http://help.kite.com/">Help</a></li>
    </ul>
    `;
  }

  renderEmailWarning(account) {
    return account.email_verified
      ? ''
      : `<div class="kite-warning-box">
        Please verify your email address

        <div class="actions">
          <a href="https://alpha.kite.com/account/resetPassword/request?email=${account.email}">Resend email</a>
        </div>
      </div>`;
  }

  renderStatus(status, syncStatus, projectDir) {
    let content = '';
    switch (status) {
      case STATES.UNSUPPORTED:
        content = `<div class="text-danger">Kite engine is not available on your system ${dot}</div>`;
        break;

      case STATES.UNINSTALLED:
        content = `
          <div class="text-danger">Kite engine is not installed ${dot}</div>
          <a href="http://kite.com" class="btn error">Install now</a>
        `;
        break;
      case STATES.INSTALLED:
        content = `
          <div class="text-danger">Kite engine is not running ${dot}</div>
          <a href="#" 
             onclick="requestGet('/status/start').then(() => requestGet('/status/reload'))" 
             class="btn error">Launch now</a>
        `;
        break;
      case STATES.RUNNING:
        content = `
          <div class="text-danger">Kite engine is not reachable</div>
        `;
        break;
      case STATES.REACHABLE:
        content = `
          <div class="text-danger">Kite engine is not logged in ${dot}</div>
          <a href="kite-atom-login://login" class="btn error">Login now</a>
        `;
        break;
      case STATES.AUTHENTICATED:
        const editor = vscode.window.activeTextEditor;
        if (!editor || (editor && (!this.Kite.isGrammarSupported(editor) ||
            this.Kite.isEditorWhitelisted(editor)))) {
          if (editor && editor.document.getText().length >= MAX_FILE_SIZE) {
            content = `
            <div class="text-warning">The current file is too large for Kite to handle ${dot}</div>`;
          } else {
            switch (syncStatus.status) {
              case 'ready':
                content = `<div class="ready">Kite engine is ready and working ${dot}</div>`;
                break;

              case 'indexing':
                content = `<div class="ready">Kite engine is indexing your code ${dot}</div>`;
                break;

              case 'syncing':
                content = `<div class="ready">Kite engine is syncing your code ${dot}</div>`;
                break;
            }
          }
        } else {
          const path = encodeURI(editor.document.fileName);
          const settingsURL = `http://localhost:46624/settings/permissions?filename=${path}`;
          content = `
            <div class="text-warning">Kite engine is not enabled for this file ${dot}</div>

            <a href='#' 
               onclick="requestGet('/status/whitelist?dirpath=${projectDir}').then(() => requestGet('/status/reload'))"
               class="btn warning">Enable for ${projectDir}</a>
            <a href="${settingsURL}" class="btn warning">Whitelist settings…</a>
          `;
        }

        break;
    }

    return `<div class="status">${content}</div>`;
  }

  renderSubscription(plan, status) {
    if (!plan || (status && status < STATES.AUTHENTICATED)) { return ''; }

    let leftSide = '';
    let rightSide = '';

    if (!Plan.isPro() && Plan.isActive()) {
      leftSide = `<div class="logo">${logo}</div> Kite Basic`;

      if (Plan.hasStartedTrial()) {
        rightSide = `<a href='command:kite.web-url?"http://localhost:46624/redirect/pro"'>Upgrade</a>`;
      } else {
        rightSide = `<a href='command:kite.web-url?"http://localhost:46624/redirect/trial"'>Start Pro trial</a>`;
      }
    } else if (Plan.isPro()) {
      leftSide = `<div class="pro">${proLogoSvg}</div>`;

      if (Plan.isTrialing()) {
        const days = Plan.remainingTrialDays();
        const remains = [
          'Trial:',
          days,
          pluralize(days, 'day', 'days'),
          'left',
        ].join(' ');

        if (days < 5) {
          leftSide += `<span class="kite-trial-days text-danger">${remains}</span>`;
        } else {
          leftSide += `<span class="kite-trial-days">${remains}</span>`;
        }

        rightSide = `<a href='command:kite.web-url?"http://localhost:46624/redirect/pro"'>Upgrade</a>`;
      } else {
        rightSide = `<a href='command:kite.web-url?"http://localhost:46624/redirect/pro"'>Account</a>`;
      }
    }

    return `<div class="split-line">
      <div class="left">${leftSide}</div>
      <div class="right">${rightSide}</div>
    </div>`;
  }
}
