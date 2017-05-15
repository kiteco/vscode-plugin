'use strict';

const server = require('./server');
const {wrapHTML, debugHTML, logo} = require('./html-utils');

module.exports = class KiteLogin {
  constructor(Kite) {
    this.Kite = Kite;
  }

  dispose() {}

  provideTextDocumentContent() {
    server.start();

    return Promise.resolve(`
      
      <script>
        window.PORT = ${server.PORT};
      </script>
    `)
    .then(html => wrapHTML(html))
    .then(html => debugHTML(html));
  }
}
