'use strict';

const vscode = require('vscode');
const {StateController, Logger} = require('kite-installer')
const {promisifyRequest, promisifyReadResponse, parseJSON} = require('./utils');
const {valueReportPath, hoverPath} = require('./urls');
const {renderModule, renderFunction, renderInstance} = require('./html-utils');
const {reportFromHover} = require('./data-utils');
const Plan = require('./plan');

module.exports = {
  render(id) {
    const path = valueReportPath(id);

    return Plan.queryPlan()
    .then(() => promisifyRequest(StateController.client.request({path})))
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

    return Plan.queryPlan()
    .then(() => promisifyRequest(StateController.client.request({path})))
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
    switch(data.value.kind) {
      case 'module':
      case 'type':
        return renderModule(data);
      case 'function': 
        return renderFunction(data);
      case 'instance': 
        return renderInstance(data);
      default:
        return '';
    }
  }
}