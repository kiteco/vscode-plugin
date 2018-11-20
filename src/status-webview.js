'use strict';

const vscode = require('vscode');
const KiteAPI = require('kite-api')
const {wrapHTML, debugHTML, proLogoSvg, enterpriseLogoSvg, logo, pluralize} = require('./html-utils');
const Plan = require('./plan');
const metrics = require('./metrics');
const {accountPath, statusPath, normalizeDriveLetter} = require('./urls');
const {kiteOpen} = require('./utils');
const {MAX_FILE_SIZE} = require('./constants');
const {STATES} = KiteAPI;
const dot = '<span class="dot">•</span>';

let Kite;

module.exports = class KiteStatus {
  constructor(K) {
    Kite = K;
  }

  dispose() {

  }

  show() {
    const columnToShowIn = vscode.ViewColumn.Two;

    if(this.currentPanel) {
      this.currentPanel.reveal(columnToShowIn);
    } else {
      this.currentPanel = vscode.window.createWebviewPanel('kite-status', "Kite Status", columnToShowIn, {
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
          case 'start':
            return KiteAPI.runKiteAndWait().then(() => this.update());
          case 'start-enterprise':
            return KiteAPI.runKiteEnterpriseAndWait().then(() => this.update());
          case 'whitelist': 
            const dirpath = message.dirpath;
            return KiteAPI.whitelistPath(dirpath).then(() => this.update());
          case 'login':
            kiteOpen('kite://home');
            return;
          case 'resendEmail':
            return Kite.request({
              path: '/api/account/resendVerification',
              method: 'post',
            }).then(() => this.update());
          case 'reload': 
            return this.update();
          case 'command': 
            vscode.commands.executeCommand(message.name, ...(message.args || []));
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

  update() {
    if(!this.currentPanel) { return; }

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

  getUserAccountInfo() {
    const path = accountPath();

    return Kite.request({path})
    .then(account => JSON.parse(account));
  }

  getStatus(editor) {
    const def = {status: 'ready'}
    if (!editor || !Kite.isGrammarSupported(editor)) {
      return Promise.resolve(def);
    }

    const filepath = normalizeDriveLetter(editor.document.fileName);
    const path = statusPath(filepath);


    return Kite.request({path})
    .then(json => JSON.parse(json))
    .catch(() => def);
  }

  getHTML() {
    return this.renderCurrent()
    .then(html => `<div class="kite-status-panel">${html}</div>`)
    .then(html => wrapHTML(html))
    .then(html => debugHTML(html))
  }

  renderCurrent() {
    const editor = vscode.window.activeTextEditor;
    const promises = [
      Plan.queryPlan().catch(() => null),
      KiteAPI.checkHealth().then(state => {
        return Promise.all([
          KiteAPI.isKiteInstalled().then(() => true, () => false),
          KiteAPI.isKiteEnterpriseInstalled().then(() => true, () => false),
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

    if (Kite.isGrammarSupported(editor)) {
      promises.push(Kite.projectDirForEditor(editor.document).catch(() => null));
      promises.push(Kite.shouldOfferWhitelist(editor.document).catch(() => null));
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
          <a href='#'
             title="Invite friends to use Kite"
             onclick="vscode.postMessage({command: 'command', name: 'kite.web-url', args: ['http://localhost:46624/redirect/invite']})"
             class="kite-gift account-dependent">Invite friends <i class="icon-kite-gift"></i></a>
        </li>`;
      } else {
        if (Plan.referralsCredited() < Plan.referralsCredits()) {
          giftLink = `<li>
            <a href='#'
               title="Get a free pro account"
               onclick="vscode.postMessage({command: 'command', name: 'kite.web-url', args: ['http://localhost:46624/redirect/invite']})"
               class="kite-gift account-dependent">Get free Pro! <i class="icon-kite-gift"></i></a>
          </li>`;
        } else {
          giftLink = `<li>
            <a href='#'
              onclick="vscode.postMessage({command: 'command', name: 'kite.web-url', args: ['http://localhost:46624/redirect/invite']})"
               title="Invite friends to use Kite"
               class="kite-gift account-dependent">Invite friends <i class="icon-kite-gift"></i></a>
          </li>`;
        }
      }
    }

    return `
    <ul class="links ${account ? 'has-account' : 'no-account'}">
      ${giftLink}
      <li><a href='#'
             title="Open Kite web docs search"
             onclick="vscode.postMessage({command: 'command', name: 'kite.web-url', args: ['http://localhost:46624/clientapi/desktoplogin?d=/docs']})"
             class="account-dependent">Kite Search</a></li>
      <li><a href="#"
             title="Open Kite settings in the copilot application"
             onclick="vscode.postMessage({command: 'command', name: 'kite.open-settings'})"
             class="account-dependent">Settings</a></li>
             <li>
             <a href='#'
             title="Open Kite permissions in the copilot application"
             onclick="vscode.postMessage({command: 'command', name: 'kite.open-permissions'})"
             class="account-dependent">Permissions</a></li>
      <li><a href="http://help.kite.com/category/46-vs-code-integration"
             title="Open Kite help in your browser">Help</a></li>
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
          title="Resend a comfirmation email to ${account.email}"
          class="resend-email"
          data-failure="We were unable to send a verification email,<br/>please contact feedback@kite.com."
          data-confirmation="A new verification email was sent to ${account.email}">Resend email</a>
        </div>
      </div>`;
  }

  renderReferralsCredited(plan) {
    return '';
    // return Plan.hasReferralCredits()
    //   ? `<div class="kite-info-b ox">
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
          <a href="https://kite.com/download" class="btn error">Install now</a>
        `;
        break;
      case STATES.INSTALLED:
        if (KiteAPI.hasManyKiteInstallation() ||
            KiteAPI.hasManyKiteEnterpriseInstallation()) {
          content = `<div class="text-danger">Kite engine is not running ${dot}<br/>You have multiple versions of Kite installed.<br/>Please launch your desired one.</div>`;
        } else if (status.kiteInstalled && status.kiteEnterpriseInstalled) {
          content = `
            <div class="text-danger">Kite engine is not running ${dot}<br/>Which version of kite do you want to launch?</div>
            <a href="#"
               onclick="vscode.postMessage({command: 'start-enterprise'});"
               class="btn purple">Launch Kite Enterprise</a><br/>
            <a href="#"
               onclick="vscode.postMessage({command: 'start'});"
               class="btn primary">Launch Kite cloud</a>
          `;
        } else if (status.kiteInstalled) {
          content = `
            <div class="text-danger">Kite engine is not running ${dot}</div>
            <a href="#"
              onclick="vscode.postMessage({command: 'start'});"
              class="btn error">Launch now</a>
          `;
        } else if (status.kiteEnterpriseInstalled) {
          content = `
            <div class="text-danger">Kite engine is not running ${dot}</div>
            <a href="#"
              onclick="vscode.postMessage({command: 'start-enterprise'});"
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
             onclick="vscode.postMessage({command: 'login'});"
             class="btn error">Login now</a>
        `;
        break;
      case STATES.AUTHENTICATED:
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          content = `<div>Open a supported file to see Kite's status ${dot}</div>`;
        } else if (!Kite.isGrammarSupported(editor)) {
          content = `<div>Open a supported file to see Kite's status ${dot}</div>`;
        } else if (Kite.isEditorWhitelisted(editor)) {
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
                 onclick="vscode.postMessage({command: 'whitelist', dirpath:'${projectDir}'});"
                 class="btn warning">Enable for ${projectDir}</a><br/>
              <a href="${settingsURL}" title="Open Kite permissions in the copilot application" class="btn warning">Whitelist settings…</a>`
            : `<div>The current file is ignored by Kite ${dot}</div>
              <a href="${settingsURL}" title="Open Kite permissions in the copilot application" class="btn">Whitelist settings…</a>`;
        }
        break;
    }

    return `<div class="status">${content}</div>`;
  }

  renderSubscription(plan, status) {
    if (!plan || (status && status.state < STATES.AUTHENTICATED)) { return ''; }

    let leftSide = '';
    let rightSide = '';
    
    if (Plan.isEnterprise()) {
      leftSide = `<div class="enterprise">${enterpriseLogoSvg}</div>`;
      rightSide = `<a is="kite-localtoken-anchor"
                      title="Open your account page"
                      href="http://localhost:46624/clientapi/desktoplogin?d=/settings/acccount">Account</a>`;
    } else if (!Plan.isPro() && Plan.isActive()) {
      leftSide = `<div class="logo">${logo}</div> Kite Basic`;
      
      if (Plan.hasStartedTrial()) {
        rightSide = `<a href="#" 
                        title="Upgrade your plan to Kite Pro"
                        onclick="vscode.postMessage({command: 'command', name:'kite.web-url', args:['http://localhost:46624/redirect/pro']})">Upgrade</a>`;
      } else {
        rightSide = `<a href="#" 
                        title="Start your Kite Pro trial"
                        onclick="vscode.postMessage({command: 'command', name:'kite.web-url', args:['http://localhost:46624/redirect/trial']})">Start Pro trial</a>`;
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

        if (days < 7) {
          leftSide += `<span class="kite-trial-days">${remains.join(' ')}</span>`;
          rightSide = `<a is="kite-localtoken-anchor"
                          href="#"
                          title="Upgrade your plan to Kite Pro"
                          onclick="vscode.postMessage({command: 'command', name:'kite.web-url', args:['http://localhost:46624/redirect/pro']})">Upgrade</a>`;
        } else {
          rightSide = `<a href='#'
                          title="Need more information about Kite Pro?"
                          onclick="vscode.postMessage({command: 'command', name:'kite.web-url', args:['https://help.kite.com/article/65-kite-pro']})">What's this?</a>`;
        }

      } else {
        rightSide = `<a is="kite-localtoken-anchor"
                        title="Open your account page"
                        href="http://localhost:46624/clientapi/desktoplogin?d=/settings/acccount">Account</a>`;
      }
    }

    return `<div class="split-line">
      <div class="left">${leftSide}</div>
      <div class="right">${rightSide}</div>
    </div>`;
  }
}