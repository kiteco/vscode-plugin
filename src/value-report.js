'use strict';

const vscode = require('vscode');
const {StateController, Logger} = require('kite-installer')
const {promisifyRequest, promisifyReadResponse, parseJSON} = require('./utils');
const {valueReportPath, hoverPath} = require('./urls');
const {renderModule, renderFunction, renderInstance, wrapHTML} = require('./html-utils');
const {reportFromHover} = require('./data-utils');

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
    .then(data => this.renderData(data))
  },

  renderFromRange(document, range) {
    const [start, end] = range;
    const path = hoverPath(document, {
      start: new vscode.Position(start.line, start.character), 
      end: new vscode.Position(end.line, end.character)
    });

    return promisifyRequest(StateController.client.request({path}))
    .then(resp => {
      Logger.logResponse(resp);
      if (resp.statusCode !== 200) {
        throw new Error(`${resp.statusCode} at ${path}`);
      }
      return promisifyReadResponse(resp);
    })
    .then(report => parseJSON(report))
    .then(data => reportFromHover(data))
    .then(data => this.renderData(data))
  },

  renderData(data) {
    let html;
    switch(data.value.kind) {
      case 'module':
      case 'type':
        html = renderModule(data);
      case 'function': 
        html = renderFunction(data);
      case 'instance': 
        html = renderInstance(data);
    }

    return wrapHTML(html);
  }
}