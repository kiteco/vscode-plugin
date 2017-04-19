'use strict';

const {StateController, Logger} = require('kite-installer')
const {promisifyRequest, promisifyReadResponse, parseJSON} = require('./utils');
const {valueReportPath} = require('./urls');
const {renderModule, renderFunction, renderInstance, wrapHTML} = require('./html-utils');

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
    .then(report => {
      if (report.value && report.value.id === '') { report.value.id = id; }
      return report;
    })
    .then(data => {
      switch(data.value.kind) {
        case 'module':
        case 'type':
          return renderModule(data);
        case 'function': 
          return renderFunction(data);
        case 'instance': 
          return renderInstance(data);
      }
    })
    .then(html => wrapHTML(html));
  }
}