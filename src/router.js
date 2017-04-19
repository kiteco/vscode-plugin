'use strict';

const vscode = require('vscode');
const {Logger} = require('kite-installer');
const KiteValueReportProvider = require('./value-report');
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
    console.log('on did change called');
    return this.didChangeEmitter.event; 
  }

  dispose() {
  }

  provideTextDocumentContent() {
    console.log('provideTextDocumentContent called for uri', String(this.currentURI))
    let {authority, path} = this.currentURI;
    path = path.replace(/^\//, '');

    switch(authority) {
      case 'value':
        return KiteValueReportProvider.render(path);
      default:
        return Promise.resolve(wrapHTML(`Unknown route '${authority}/${path}'`))
    }
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