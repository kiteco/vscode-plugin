'use strict';

const vscode = require('vscode');
const server = require('./server');

const URI = vscode.Uri.parse('kite-vscode-autocorrect://autocorrect');
const {wrapHTML, debugHTML} = require('./html-utils');

server.addRoute('GET', '/status/login', (req, res, url) => {
  vscode.commands.executeCommand('vscode.previewHtml', 'kite-vscode-login://login', vscode.ViewColumn.Two, 'Kite Login');
  res.writeHead(200);
  res.end();
});

module.exports = class KiteAutocorrect {
  constructor(Kite) {
    this.Kite = Kite;
    this.didChangeEmitter = new vscode.EventEmitter();
    vscode.window.onDidChangeActiveTextEditor(e => {
      this.update();
      this.Kite.autocorrectStatusBarItem.hide();
    });
    vscode.workspace.onDidCloseTextDocument(doc => {
      if (doc.uri.toString().indexOf('kite-vscode-autocorrect://') === 0) {
        delete this.isSidebarOpen;
      }
    });
  }

  get onDidChange() {
    return this.didChangeEmitter.event; 
  }

  open() {
    if (this.isSidebarOpen) {
      this.update();
    } else {
      vscode.commands.executeCommand('vscode.previewHtml', URI, vscode.ViewColumn.Two, 'Kite');
      this.isSidebarOpen = true;
    }
  } 

  update() {
    this.didChangeEmitter.fire(URI);
  }

  dispose() {
    this.subscription.dispose();
  }

  provideTextDocumentContent() {
    const kiteEditor = this.Kite.kiteEditorByEditor.get(vscode.window.activeTextEditor.document.fileName)

    console.log('update', kiteEditor != null)
    if(kiteEditor && kiteEditor.fixesHistory) {
      
      return Promise.resolve(`
      <div class="kite-autocorrect-sidebar">
        <div class="kite-sidebar-resizer"></div>
        <div class="kite-column">
          <div class="content">${this.renderDiffs([
            kiteEditor.fixesHistory,
            vscode.window.activeTextEditor.document.fileName,
          ])}</div>
          <footer>
            <label>
              <input type="checkbox"></input>
              Show this panel on every save
            </label>
          </footer>
        </div>
      </div>`)
      .then(html => wrapHTML(html))
      .then(html => debugHTML(html));
    } else {
      return '';
    }
  }

  renderDiffs([history, filename] = []) {
    if (history) {
      const diffsHTML = history.map(fix =>
        `<div class="diff">
          <div class="timestamp">
            Fixed ${fix.diffs.length} ${fix.diffs.length === 1 ? 'error' : 'errors'} on ${fix.timestamp}
          </div>
          ${fix.diffs.map(diff =>
            [
              '<code class="diff-content">',
              diff.deleted.map(del => `<del>
                <div class="line-number">${del.line + 1}</div>
                <div class="line">${del.text}</div>
              </del>`).join(''),
              diff.inserted.map(ins => `<ins>
                <div class="line-number">${ins.line + 1}</div>
                <div class="line">${ins.text}</div>
              </ins>`).join(''),
              '</code>',
            ].join('')
          ).join('')}
          <div class="feedback-actions">
            <a class="thumb-down">👎</a>
            <a class="thumb-up">👍</a>
          </div>
        </div>`
      ).join('');

      return `
        <div class="file">Corrections in ${filename}</div>
        <div class="diffs">${diffsHTML}</div>
      `;
    } else {
      return '';
    }
  }
}