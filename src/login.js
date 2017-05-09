'use strict';

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const {AccountManager, Logger} = require('kite-installer');
const server = require('./server');
const {wrapHTML, logo} = require('./html-utils');
const {promisifyReadResponse} = require('./utils');

const INVALID_PASSWORD = 6;
const PASSWORD_LESS_USER = 9;

server.addRoute('GET', '/login', (req, res, url) => { 
  const data = params(url);

  AccountManager.login(data).then(resp => {
    Logger.logResponse(resp);
    if (resp.statusCode === 200) {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('ok');
    } else {
      return promisifyReadResponse(resp).then(data => {
        res.writeHead(resp.statusCode, {'Content-Type': 'text/plain'});
        data = JSON.parse(data);
        switch (data.code) {
          case INVALID_PASSWORD:
            res.end('Invalid Password');
          case PASSWORD_LESS_USER:
            res.end('Password not set');
          default:
            this.emitter.emit('did-get-unauthorized');
            res.end('Unauthorized');
        }
      });
    }
  })
  .catch(err => {
    res.writeHead(500, {'Content-Type': 'text/plain'});
    res.end(err.stack);
  });
});


module.exports = class KiteLogin {
  constructor(Kite) {
    this.Kite = Kite;
  }

  dispose() {}

  provideTextDocumentContent() {
    server.start();

    return Promise.resolve(`
      <form class="login-form">
        <div class="pull-right">${logo}</div>
        <div class="block has-password">Sign into Kite:</div>
        <div class="block text-warning no-password">It looks like you didn't set a password for your account yet.</div>
        <div class="block has-password">
          <input class="input-text" name="email" type="text" placeholder="Email" tabindex="1">
        </div>
        <div class="block has-password">
          <input class="input-text" name="password" type="password" placeholder="Password" tabindex="2">
        </div>
        <div>
          <a class="reset-password pull-right has-password"
             href="#">Reset Password</a>
          <a class="signup pull-right"
             href="https://kite.com/">Signup</a>
          <button type="submit" class="primary has-password">Sign into Kite</button>
          <button type="button" class="cancel">Cancel</button>
          <button type="button" class="send-link no-password primary">
            Resend password setup email
          </button>
        </div>
        <div class="form-status"></div>
      </form>

      <script>
        window.PORT = ${server.PORT};
        initLogin();
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

function params (url) {
  return url.query.split('&').reduce((m, p) => {
    const [k,v] = p.split('=');
    m[k] = v;
    return m;
  }, {})
};