'use strict';

const URL = require('url');
const http = require('http');
const {Logger} = require('kite-installer');
const {head, last} = require('./utils');

module.exports = {
  PORT: 45667,
  routes: [],
  addRoute(method, route, handle) {
    this.routes.push([method, route, handle]);
  },

  dispose() {
    if (this.started) { this.stop(); }
  },

  start() {
    if (this.started) { return; }

    this.server = http.createServer((req, res) => {

      const url = URL.parse(req.url);
      res.setHeader('Access-Control-Allow-Origin', '*');
      const handle = last(head(this.routes.filter(r => r[0] === req.method && r[1] === url.pathname)));
      if (handle) {
        handle(req, res, url);
      } else {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Hello World');
      }
    });

    this.server.on('clientError', (err, socket) => {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });
    
    this.server.listen(this.PORT);
    this.started = true;
    Logger.debug(`Server started on port ${this.PORT}`);
  },

  stop() {
    this.server.close(() => {
      Logger.debug('Server closed');
    })
  }
};