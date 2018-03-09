'use strict';

const vscode = require('vscode');
const server = require('./server');

const URI = vscode.Uri.parse('kite-vscode-autocorrect://autocorrect');
const {wrapHTML, debugHTML} = require('./html-utils');
let instance;

server.addRoute('GET', '/autocorrect/toggle/on', (req, res, url) => {
  try {
    const config = vscode.workspace.getConfiguration('kite');
    config.update('openAutocorrectSidebarOnSave', true, true);  
    res.writeHead(200);
    res.end();
  } catch(err) {
    console.log(err)
    res.writeHead(500);
    res.end();
  }
});

server.addRoute('GET', '/autocorrect/toggle/off', (req, res, url) => {
  try {
    const config = vscode.workspace.getConfiguration('kite');
    config.update('openAutocorrectSidebarOnSave',false, true);  
    res.writeHead(200);
    res.end();
  } catch(err) {
    console.log(err)
    res.writeHead(500);
    res.end();
  }
});

server.addRoute('GET', '/autocorrect/feedback/ok', (req, res, url) => {
  try {
    const kiteEditor = instance.lastKiteEditor
  
    if(kiteEditor && kiteEditor.fixesHistory) {
      kiteEditor.postAutocorrectFeedbackData(kiteEditor.lastCorrectionsData, 1).then(() => {
        kiteEditor.lastCorrectionsData.feedbackSent = 1
        instance.update();
      });
    }
  
    res.writeHead(200);
    res.end();
  } catch(err) {
    console.log(err)
    res.writeHead(500);
    res.end();
  }
});

server.addRoute('GET', '/autocorrect/feedback/ko', (req, res, url) => {
  try {
    const kiteEditor = instance.lastKiteEditor

    if(kiteEditor && kiteEditor.fixesHistory) {
      kiteEditor.postAutocorrectFeedbackData(kiteEditor.lastCorrectionsData, -1).then(() => {
        kiteEditor.lastCorrectionsData.feedbackSent = -1
        instance.update();
      });
    }

    res.writeHead(200);
    res.end();
  } catch(err) {
    console.log(err)
    res.writeHead(500);
    res.end();
  }
});

module.exports = class KiteAutocorrect {
  constructor(Kite) {
    server.start();

    this.Kite = Kite;
    instance = this;
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
    const kiteEditor = vscode.window.activeTextEditor 
      ? this.Kite.kiteEditorByEditor.get(vscode.window.activeTextEditor.document.fileName)
      : this.lastKiteEditor

    if(kiteEditor && kiteEditor.fixesHistory) {
      this.lastKiteEditor = kiteEditor
      const config = vscode.workspace.getConfiguration('kite');
      
      return Promise.resolve(`
      <div class="kite-autocorrect-sidebar">
        <div class="kite-sidebar-resizer"></div>
        <div class="kite-column">
          <div class="content">${this.renderDiffs([
            kiteEditor.fixesHistory,
            kiteEditor.document.fileName,
            kiteEditor,
          ])}</div>
          <footer>
            <label>
              <input type="checkbox"
                     onchange="requestGet('/autocorrect/toggle/' + (this.checked ? 'on' : 'off'))"
                     ${config.openAutocorrectSidebarOnSave ? 'checked' : ''}></input>
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

  renderDiffs([history, filename, kiteEditor] = []) {
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
          <div class="feedback-actions ${kiteEditor.lastCorrectionsData.feedbackSent ? 'feedback-sent' : ''}">
            <a class="thumb-down ${kiteEditor.lastCorrectionsData.feedbackSent == -1 ? 'clicked' : ''}"
               href="#"
               onclick="requestGet('/autocorrect/feedback/ko')">👎</a>
            <a class="thumb-up ${kiteEditor.lastCorrectionsData.feedbackSent == 1 ? 'clicked' : ''}" 
               href="#"
               onclick="requestGet('/autocorrect/feedback/ok')">👍</a>
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