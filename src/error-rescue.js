'use strict';

const vscode = require('vscode');
const server = require('./server');
const {AUTOCORRECT_SHOW_SIDEBAR, AUTOCORRECT_DONT_SHOW_SIDEBAR} = require('./constants');
const URI = vscode.Uri.parse('kite-vscode-error-rescue://error-rescue');
const {wrapHTML, debugHTML} = require('./html-utils');
let instance;

server.addRoute('GET', `/error-rescue/toggle/${AUTOCORRECT_SHOW_SIDEBAR}`, (req, res, url) => {
  try {
    const config = vscode.workspace.getConfiguration('kite');
    config.update('actionWhenErrorRescueFixesCode', AUTOCORRECT_SHOW_SIDEBAR, true);  
    res.writeHead(200);
    res.end();
  } catch(err) {
    console.log(err)
    res.writeHead(500);
    res.end();
  }
});

server.addRoute('GET', `/error-rescue/toggle/${AUTOCORRECT_DONT_SHOW_SIDEBAR}`, (req, res, url) => {
  try {
    const config = vscode.workspace.getConfiguration('kite');
    config.update('actionWhenErrorRescueFixesCode', AUTOCORRECT_DONT_SHOW_SIDEBAR, true);  
    res.writeHead(200);
    res.end();
  } catch(err) {
    console.log(err)
    res.writeHead(500);
    res.end();
  }
});

server.addRoute('GET', '/error-rescue/feedback/ok', (req, res, url) => {
  try {
    const kiteEditor = instance.lastKiteEditor
  
    if(kiteEditor && kiteEditor.fixesHistory) {
      kiteEditor.postErrorRescueFeedbackData(kiteEditor.lastCorrectionsData, 1).then(() => {
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

server.addRoute('GET', '/error-rescue/feedback/ko', (req, res, url) => {
  try {
    const kiteEditor = instance.lastKiteEditor

    if(kiteEditor && kiteEditor.fixesHistory) {
      kiteEditor.postErrorRescueFeedbackData(kiteEditor.lastCorrectionsData, -1).then(() => {
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

module.exports = class KiteErrorRescue {
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
      if (doc.uri.toString().indexOf('kite-vscode-error-rescue://') === 0) {
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
      <div class="kite-error-rescue-sidebar">
        <div class="kite-column">
          <div class="messages"></div>
          <div class="settings-view">
            <a href="https://help.kite.com/article/78-what-is-error-rescue" title="Learn about Error Rescue" class="icon icon-question"></a>
            <div class="settings-panel">
              <div class="control-group checkbox">
                <label>
                  <input type="checkbox" class="input-toggle"></input>
                  <div class="setting-title">Enable Error Rescue</div>
                </label>
              </div>
              <div class="control-group select">
                <label>
                  <div class="setting-title">Any time code is fixed:</div>
                  <select type="checkbox" class="form-control" onchange="requestGet('/error-rescue/toggle/' + this.value">
                    <option value="${AUTOCORRECT_SHOW_SIDEBAR}">Reopen this sidebar</option>
                    <option value="${AUTOCORRECT_DONT_SHOW_SIDEBAR}">Do nothing (fix code quietly)</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
          <div class="content">${this.renderDiffs([
            kiteEditor.fixesHistory,
            kiteEditor.document.fileName,
            kiteEditor,
          ])}</div>
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
               onclick="requestGet('/error-rescue/feedback/ko')">👎</a>
            <a class="thumb-up ${kiteEditor.lastCorrectionsData.feedbackSent == 1 ? 'clicked' : ''}" 
               href="#"
               onclick="requestGet('/error-rescue/feedback/ok')">👍</a>
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