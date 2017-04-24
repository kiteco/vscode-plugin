'use strict';

const fs = require('fs');
const pth = require('path');
const vscode = require('vscode');
const KiteValueReport = require('./value-report');
const KiteMembersList = require('./members-list');
const KiteExamplesList = require('./examples-list');
const KiteLinksList = require('./links-list');
const KiteCuratedExample = require('./curated-example');
const metrics = require('./metrics');
const {wrapHTML} = require('./html-utils');
const URI = 'kite-vscode-internal://sidebar'

module.exports = class KiteRouter {
  constructor() {
    this.didChangeEmitter = new vscode.EventEmitter();
    vscode.workspace.onDidCloseTextDocument(doc => {
      if (doc.uri.toString().indexOf('kite-vscode-internal://') === 0) {
        delete this.sidebarIsOpen;
      }
    });
  }

  get onDidChange() { 
    return this.didChangeEmitter.event; 
  }

  dispose() {
  }

  provideTextDocumentContent() {
    let {authority, path} = this.currentURI;
    let promise
    path = path.replace(/^\//, '');

    switch(authority) {
      case 'value':
        metrics.track(`Navigation to value report clicked`);
        promise =  KiteValueReport.render(path);
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
        promise = Promise.resolve(wrapHTML(`Unknown route '${authority}/${path}'`))
    }

    return promise.then(html => {
      fs.writeFileSync(pth.resolve(__dirname, '..', 'sample.html'), `<!doctype html>
      <html class="vscode-dark">
      <style> 
        html {
          background: #333333;
          color: #999999;
          font-family: sans-serif;
          font-size: 14px;
          line-height: 1.4em;
        }
      </style>
      ${html}
      </html>
      `)
      return html
    })
  }

  navigate(uri) {
    this.currentURI = vscode.Uri.parse(uri);
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