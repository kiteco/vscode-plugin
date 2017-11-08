'use strict';

const formidable = require('formidable');
const server = require('./server');
const {wrapHTML, debugHTML} = require('./html-utils');
const {params, compact, flatten} = require('./utils');
const {searchPath} = require('./urls');
const KiteValueReport = require('./value-report');
const localconfig = require('./localconfig');

let history = localconfig.get('searchHistory');

let lastTerm, lastList, lastId, lastView, Kite;

const GETTING_STARTED = [
  'json',
  'requests.get',
  'matplotlib.pyplot.plot',
];

server.addRoute('GET', '/search', (req, res, url) => { 
  if (!Kite) { Kite = require('./kite'); }

  const text = params(url).text;
  const path = searchPath(text);

  lastTerm = text;

  Kite.request({path})
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

server.addRoute('POST', '/search/stack', (req, res, url) => {
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields) => {
    if (err) {
      res.writeHead(500, {'Content-Type': 'text/plain'});
      return res.end(err.stack);
    }

    const {q} = fields

    try {
      if (history && !history.includes(q)) {
        history.unshift(q);
        history = history.slice(0,5)
        localconfig.set('searchHistory', history);
      } else if (!history) {
        history = [q];
        localconfig.set('searchHistory', history);
      }
  
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end(JSON.stringify(history));
    } catch (err) {
      res.writeHead(500, {'Content-Type': 'text/plain'});
      return res.end(err.stack);
    }
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

  dispose() {}

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
        initSearch('text', 'results', 'view', ${JSON.stringify(history)}, ${JSON.stringify(GETTING_STARTED)});
      </script>
    `)
    .then(html => wrapHTML(html))
    .then(html => debugHTML(html))
  }
}

function renderList(results) {
  lastList = results

  if (results && results.python_results) {

    const localResults = (results.python_results.local_results || {results: []}).results || []
    const globalResults = (results.python_results.global_results || {results: []}).results || []
    const allResults = compact(flatten([
      localResults.map(r => {
        r.local = true;
        return r;
      }),
      globalResults.map(r => {
        r.local = false;
        return r;
      }),
    ]));

    return allResults
    .filter(r => r.result.repr && r.result.repr.trim() !== '')
    .map(r =>
      `<li data-id="${r.result.id}" ${lastId === r.result.id ? 'class="selected"' : ''}>
        ${r.result.repr} ${r.local ? '<small>Local</small>' : ''}
      </li>`
    ).join('');
  } else {
    return '';
  }
}