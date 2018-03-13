'use strict';

const vscode = require('vscode');
const {StateController, Logger} = require('kite-installer');
const server = require('./server');
const {wrapHTML, debugHTML, proLogoSvg, enterpriseLogoSvg, logo, pluralize} = require('./html-utils');
const Plan = require('./plan');
const {accountPath, statusPath, normalizeDriveLetter} = require('./urls');
const {promisifyRequest, promisifyReadResponse, params} = require('./utils');
const {MAX_FILE_SIZE} = require('./constants');
const {STATES} = StateController;
const dot = '<span class="dot">•</span>';

let Kite;

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

server.addRoute('GET', '/status/start-enterprise', (req, res, url) => {
  StateController.runKiteEnterpriseAndWait()
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


server.addRoute('GET', '/status/login', (req, res, url) => {
  vscode.commands.executeCommand('vscode.previewHtml', 'kite-vscode-login://login', vscode.ViewColumn.Two, 'Kite Login');
  res.writeHead(200);
  res.end();
});

server.addRoute('GET', '/status/resendEmail', (req, res, url) => {
  if (!Kite) { Kite = require('./kite'); }
  Kite.request({
    path: '/api/account/resendVerification',
    method: 'post',
  })
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
    this.didChangeEmitter.fire(vscode.Uri.parse('kite-vscode-status://status'));
  }

  dispose() {}

  provideTextDocumentContent() {
    server.start();

    return this.renderCurrent()
    .then(html => `<div class="kite-status-panel">${html}</div>`)
    .then(html => wrapHTML(html))
    .then(html => debugHTML(html));
  }

  getUserAccountInfo() {
    const path = accountPath();

    return this.Kite.request({path})
    .then(account => JSON.parse(account));
  }

  getStatus(editor) {
    const def = {status: 'ready'}
    if (!editor || !this.Kite.isGrammarSupported(editor)) {
      return Promise.resolve(def);
    }

    const filepath = normalizeDriveLetter(editor.document.fileName);
    const path = statusPath(filepath);

    return this.Kite.request({path})
    .then(json => JSON.parse(json))
    .catch(() => def);
  }

  renderCurrent() {
    const editor = vscode.window.activeTextEditor;
    const promises = [
      Plan.queryPlan().catch(() => null),
      StateController.handleState().then(state => {
        return Promise.all([
          StateController.isKiteInstalled().then(() => true, () => false),
          StateController.isKiteEnterpriseInstalled().then(() => true, () => false),
        ]).then(([kiteInstalled, kiteEnterpriseInstalled]) => {
          return {
            state,
            kiteInstalled,
            kiteEnterpriseInstalled,
          };
        });
      }),
      this.getUserAccountInfo().catch(() => {}),
      this.getStatus(editor),
    ];
    if (this.Kite.isGrammarSupported(editor)) {
      promises.push(this.Kite.projectDirForEditor(editor.document).catch(() => null));
      promises.push(this.Kite.shouldOfferWhitelist(editor.document).catch(() => null));
    }

    return Promise.all(promises).then(data => this.render(...data));
  }

  render(plan, status, account, syncStatus, projectDir, shouldOfferWhitelist) {
    return `
      ${this.renderSubscription(plan, status)}
      ${this.renderEmailWarning(account)}
      ${this.renderReferralsCredited(plan)}
      ${this.renderLinks(account)}
      ${this.renderStatus(status, syncStatus, projectDir, shouldOfferWhitelist)}
      <script>initStatus();</script>
    `;
  }

  renderLinks(account) {
    let giftLink = '';

    if (!Plan.isEnterprise()) {
      if (Plan.isPro()) {
        giftLink = `<li>
          <a href='command:kite.web-url?"http://localhost:46624/redirect/invite"'
             class="kite-gift account-dependent">Invite friends <i class="icon-kite-gift"></i></a>
        </li>`;
      } else {
        if (Plan.referralsCredited() < Plan.referralsCredits()) {
          giftLink = `<li>
            <a href='command:kite.web-url?"http://localhost:46624/redirect/invite"'
               class="kite-gift account-dependent">Get free Pro! <i class="icon-kite-gift"></i></a>
          </li>`;
        } else {
          giftLink = `<li>
            <a href='command:kite.web-url?"http://localhost:46624/redirect/invite"'
               class="kite-gift account-dependent">Invite friends <i class="icon-kite-gift"></i></a>
          </li>`;
        }
      }
    }

    return `
    <ul class="links ${account ? 'has-account' : 'no-account'}">
      ${giftLink}
      <li><a href='command:kite.web-url?"http://localhost:46624/clientapi/desktoplogin?d=/docs"' 
             class="account-dependent">Search Python documentation</a></li>
      <li><a href='command:kite.web-url?"http://localhost:46624/settings"' 
             class="account-dependent">Settings</a></li>
      <li><a href='command:kite.web-url?"http://localhost:46624/settings/permissions"' 
             class="account-dependent">Permissions</a></li>
      <li><a href="http://help.kite.com/category/46-vs-code-integration">Help</a></li>
    </ul>
    `;
  }

  renderEmailWarning(account) {
    return !account || account.email_verified
      ? ''
      : `<div class="kite-warning-box">
        Please verify your email address

        <div  class="actions">
          <a href="/foo"
          class="resend-email"
          data-failure="We were unable to send a verification email,<br/>please contact feedback@kite.com."
          data-confirmation="A new verification email was sent to ${account.email}">Resend email</a>
        </div>
      </div>`;
  }

  renderReferralsCredited(plan) {
    return '';
    // return Plan.hasReferralCredits()
    //   ? `<div class="kite-info-box">
    //     ${Plan.referralsCredited()}
    //     ${pluralize(Plan.referralsCredited(), 'user', 'users')}
    //     accepted your invite.<br/>We've credited
    //     ${Plan.daysCredited()}
    //     ${pluralize(Plan.daysCredited(), 'day', 'days')}
    //     of Kite Pro to your account!
    //     <div class="actions">
    //       <a is="kite-localtoken-anchor"
    //          href="http://localhost:46624/redirect/invite">Invite more people</a>
    //     </div>
    //   </div>`
    //   : '';
  }

  renderStatus(status, syncStatus, projectDir, shouldOfferWhitelist) {
    let content = '';
    switch (status.state) {
      case STATES.UNSUPPORTED:
        content = `<div class="text-danger">Kite engine is not available on your system ${dot}</div>`;
        break;

      case STATES.UNINSTALLED:
        content = `
          <div class="text-danger">Kite engine is not installed ${dot}</div>
          <a href="command:kite.install" class="btn error">Install now</a>
        `;
        break;
      case STATES.INSTALLED:
        if (StateController.hasManyKiteInstallation() ||
            StateController.hasManyKiteEnterpriseInstallation()) {
          content = `<div class="text-danger">Kite engine is not running ${dot}<br/>You have multiple versions of Kite installed.<br/>Please launch your desired one.</div>`;
        } else if (status.kiteInstalled && status.kiteEnterpriseInstalled) {
          content = `
            <div class="text-danger">Kite engine is not running ${dot}<br/>Which version of kite do you want to launch?</div>
            <a href="#"
               onclick="requestGet('/status/start-enterprise').then(() => requestGet('/status/reload'))"
               class="btn purple">Launch Kite Enterprise</a><br/>
            <a href="#"
               onclick="requestGet('/status/start').then(() => requestGet('/status/reload'))"
               class="btn primary">Launch Kite cloud</a>
          `;
        } else if (status.kiteInstalled) {
          content = `
            <div class="text-danger">Kite engine is not running ${dot}</div>
            <a href="#"
              onclick="requestGet('/status/start').then(() => requestGet('/status/reload'))"
              class="btn error">Launch now</a>
          `;
        } else if (status.kiteEnterpriseInstalled) {
          content = `
            <div class="text-danger">Kite engine is not running ${dot}</div>
            <a href="#"
              onclick="requestGet('/status/start-enterprise').then(() => requestGet('/status/reload'))"
              class="btn error">Launch now</a>
          `;
        }
        break;
      case STATES.RUNNING:
        content = `
          <div class="text-danger">Kite engine is not reachable</div>
        `;
        break;
      case STATES.REACHABLE:
        content = `
          <div class="text-danger">Kite engine is not logged in ${dot}</div>
          <a href="#"
             onclick="requestGet('/status/login')"
             class="btn error">Login now</a>
        `;
        break;
      case STATES.AUTHENTICATED:
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          content = `<div>Open a supported file to see Kite's status ${dot}</div>`;
        } else if (!this.Kite.isGrammarSupported(editor)) {
          content = `<div>Open a supported file to see Kite's status ${dot}</div>`;
        } else if (this.Kite.isEditorWhitelisted(editor)) {
          if (editor.document.getText().length >= MAX_FILE_SIZE) {
            content = `
            <div class="text-warning">The current file is too large for Kite to handle ${dot}</div>`;
          } else {
            switch (syncStatus.status) {
              case '':
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
          const path = encodeURI(normalizeDriveLetter(editor.document.fileName));
          const settingsURL = `http://localhost:46624/settings/permissions?filename=${path}`;
          content = shouldOfferWhitelist
            ? `<div class="text-warning">Kite engine is not enabled for this file ${dot}</div>
              <a href="#"
                 onclick="requestGet('/status/whitelist?dirpath=${projectDir}').then(() => requestGet('/status/reload'))"
                 class="btn warning">Enable for ${projectDir}</a><br/>
              <a href="${settingsURL}" class="btn warning">Whitelist settings…</a>`
            : `<div>The current file is ignored by Kite ${dot}</div>
              <a href="${settingsURL}" class="btn">Whitelist settings…</a>`;
        }
        break;
    }

    return `<div class="status">${content}</div>`;
  }

  renderSubscription(plan, status) {
    if (!plan || (status && status < STATES.AUTHENTICATED)) { return ''; }

    let leftSide = '';
    let rightSide = '';

    if (Plan.isEnterprise()) {
      leftSide = `<div class="enterprise">${enterpriseLogoSvg}</div>`;
      rightSide = `<a is="kite-localtoken-anchor"
                      href="http://localhost:46624/clientapi/desktoplogin?d=/settings/acccount">Account</a>`;
    } else if (!Plan.isPro() && Plan.isActive()) {
      leftSide = `<div class="logo">${logo}</div> Kite Basic`;

      if (Plan.hasStartedTrial()) {
        rightSide = `<a href='command:kite.web-url?"http://localhost:46624/redirect/pro"'>Upgrade</a>`;
      } else {
        rightSide = `<a href='command:kite.web-url?"http://localhost:46624/redirect/trial"'>Start Pro trial</a>`;
      }
    } else if (Plan.isPro()) {
      leftSide = `<div class="pro">${proLogoSvg}</div>`;

      if (Plan.isTrialing() || Plan.hasReferralCredits()) {
        const days = Plan.remainingTrialDays();
        const remains = [
          days,
          pluralize(days, 'day', 'days'),
          'left',
        ];

        if (Plan.isTrialing()) {
          remains.unshift('Trial:');
        }

        if (days < 5) {
          leftSide += `<span class="kite-trial-days text-danger">${remains.join(' ')}</span>`;
        } else {
          leftSide += `<span class="kite-trial-days ">${remains.join(' ')}</span>`;
        }

        rightSide = `<a is="kite-localtoken-anchor"
                        href="http://localhost:46624/redirect/pro">Upgrade</a>`;
      } else {
        rightSide = `<a is="kite-localtoken-anchor"
                        href="http://localhost:46624/clientapi/desktoplogin?d=/settings/acccount">Account</a>`;
      }
    }

    return `<div class="split-line">
      <div class="left">${leftSide}</div>
      <div class="right">${rightSide}</div>
    </div>`;
  }
}
