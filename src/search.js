'use strict';

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const {StateController, Logger} = require('kite-installer');
const server = require('./server');
const {wrapHTML} = require('./html-utils');
const {promisifyReadResponse} = require('./utils');
const {searchPath} = require('./urls');
const KiteValueReport = require('./value-report');

let lastTerm, lastList, lastId, lastView;

server.addRoute('GET', '/search', (req, res, url) => { 
  const text = params(url).text;
  const path = searchPath(text);

  lastTerm = text;

  StateController.client.request({path}).then(resp => {
    Logger.logResponse(resp);
    if (resp.statusCode !== 200) {
      return promisifyReadResponse(resp).then(data => {
        throw new Error(`bad status ${resp.statusCode}: ${data}`);
      });
    }

    return promisifyReadResponse(resp);
  })
  .then(data => JSON.parse(data))
  .then(data => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(renderList(data));
  })
  .catch(err => {
    res.writeHead(500, {'Content-Type': 'text/plain'});
    res.end(err.stack);
  });
});

server.addRoute('GET', '/view', (req, res, url) => {
  const id = params(url).id;

  lastId = id;

  KiteValueReport.render(id).then(html => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    lastView = html;
    res.end(html);
  })
  .catch(err => {
    res.writeHead(500, {'Content-Type': 'text/plain'});
    res.end(err.stack);
  });
});

module.exports = class KiteSearch {
  constructor(Kite) {
    this.Kite = Kite;
    // vscode.workspace.onDidCloseTextDocument(doc => {
    //   if (doc.uri.toString().indexOf('kite-vscode-search://') === 0) {
    //     clearCache();
    //   }
    // });
  }

  clearCache() {
    lastTerm = null;
    lastList = null;
    lastView = null;
    lastId = null;
  }

  provideTextDocumentContent() {
    server.start();

    return Promise.resolve(`
      <div class="search-form">
        <input type="text" id="text" placeholder="Search identifier…" ${lastTerm ? `value="${lastTerm}"` : ''}></input>
        <i class="icon icon-search"></i>
      </div>

      <ul id="results">${renderList(lastList)}</ul>
      <div id="view">${lastView || ''}</div>
      <script>
        window.PORT = ${server.PORT};
        initSearch('text', 'results', 'view');
      </script>
    `)
    .then(html => wrapHTML(html))
    .then(html => {
      if (vscode.workspace.getConfiguration('kite').sidebarDebugMode) {
        fs.writeFileSync(path.resolve(__dirname, '..', 'sample.html'), `<!doctype html>
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
      }
      return html
    })
  }
}

function renderList(results) {
  lastList = results
  return results && results.results
    ? results.results
      .filter(r => r.result.repr && r.result.repr.trim() !== '')
      .map(r => 
        lastId === r.result.id
          ? `<li data-id="${r.result.id}" class="selected">${r.result.repr}</li>`
          : `<li data-id="${r.result.id}">${r.result.repr}</li>`)
      .join('')
    : ''
}

function params (url) {
  return url.query.split('&').reduce((m, p) => {
    const [k,v] = p.split('=');
    m[k] = v;
    return m;
  }, {})
};