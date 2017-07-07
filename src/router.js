'use strict';

const vscode = require('vscode');
const KiteValueReport = require('./value-report');
const KiteMembersList = require('./members-list');
const KiteExamplesList = require('./examples-list');
const KiteLinksList = require('./links-list');
const KiteCuratedExample = require('./curated-example');
const metrics = require('./metrics');
const {wrapHTML, debugHTML, prependNavigation} = require('./html-utils');
const URI = 'kite-vscode-sidebar://sidebar'

module.exports = class KiteRouter {
  constructor() {
    this.didChangeEmitter = new vscode.EventEmitter();
    vscode.workspace.onDidCloseTextDocument(doc => {
      if (doc.uri.toString().indexOf('kite-vscode-sidebar://') === 0) {
        delete this.sidebarIsOpen;
      }
    });
    this.clearNavigation();
  }

  get onDidChange() { 
    return this.didChangeEmitter.event; 
  }

  dispose() {}

  provideTextDocumentContent() {
    let {authority, path, document} = this.navigation[this.step];
    let promise
    path = path.replace(/^\//, '');

    switch(authority) {
      case 'value':
        metrics.track(`Navigation to value report clicked`);
        promise =  KiteValueReport.render(path);
        break;
      case 'value-range':
        metrics.track(`Navigation to value report from range clicked`);
        promise =  KiteValueReport.renderFromRange(document, 
          JSON.parse(path));
        break;
      case 'members-list':
        metrics.track(`Navigation to members list clicked`);
        promise =  KiteMembersList.render(path);
        break;
      case 'links-list':
        metrics.track(`Navigation to links list clicked`);
        promise =  KiteLinksList.render(path);
        break;
      case 'examples-list':
        metrics.track(`Navigation to examples list clicked`);
        promise =  KiteExamplesList.render(path);
        break;
      case 'example':
        metrics.track(`Navigation to example clicked`);
        promise =  KiteCuratedExample.render(path);
        break;
      default:
        promise = Promise.resolve(`Unknown route '${authority}/${path}'`)
    }

    return promise
    .then(html => prependNavigation(html, this.navigation, this.step))
    .then(html => `
      ${html}
      <script>
        const sticky = new StickyTitle(
          document.querySelectorAll('h4'), 
          document.querySelector('.sections-wrapper')
        );
        handleExternalLinks();
      </script>`)
    .then(html => wrapHTML(html))
    .then(html => debugHTML(html))
  }

  clearNavigation() {
    this.navigation = [];
    this.step = 0;
  }

  chopNavigation() {
    this.navigation = this.navigation.slice(0, this.step + 1);
  }

  registerNavigationStep(uri) {
    this.step = this.navigation.length;
    uri.document = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document
    this.navigation.push(uri);
  }

  back() {
    this.step = Math.max(0, this.step - 1);
    this.update();
  }

  forward() {
    this.step = Math.min(this.navigation.length - 1, this.step + 1);
    this.update();
  }

  navigate(uri) {
    this.registerNavigationStep(vscode.Uri.parse(uri));
    if (this.isSidebarOpen()) {
      this.update();
    } else {
      vscode.commands.executeCommand('vscode.previewHtml', URI, vscode.ViewColumn.Two, 'Kite');
      this.sidebarIsOpen = true;
    }
  }

  update() {
    this.didChangeEmitter.fire(URI);
  }

  isSidebarOpen() {
    return this.sidebarIsOpen;
  }
}