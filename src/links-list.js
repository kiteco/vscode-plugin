'use strict';

const {StateController, Logger} = require('kite-installer')
const {promisifyRequest, promisifyReadResponse, parseJSON} = require('./utils');
const {valueReportPath} = require('./urls');
const {renderLinksList, wrapHTML} = require('./html-utils');

module.exports = {
  render(id) {
    const path = valueReportPath(id);

    return promisifyRequest(StateController.client.request({path}))
    .then(resp => {
      Logger.logResponse(resp);
      if (resp.statusCode !== 200) {
        throw new Error(`${resp.statusCode} at ${path}`);
      }
      return promisifyReadResponse(resp);
    })
    .then(report => parseJSON(report))
    .then(data => wrapHTML(renderLinksList(data)));
  }
}