'use strict';

const vscode = require('vscode');
const {StateController, Logger} = require('kite-installer')
const {promisifyRequest, promisifyReadResponse, parseJSON} = require('./utils');
const {valueReportPath, hoverPath} = require('./urls');
const {renderModule, renderFunction, renderInstance} = require('./html-utils');
const {reportFromHover} = require('./data-utils');
const Plan = require('./plan');
let Kite;

module.exports = {
  render(id) {
    if (!Kite) { Kite = require('./kite'); }
    const path = valueReportPath(id);

    return Plan.queryPlan()
    .then(() => Kite.request({path}))
    .then(report => parseJSON(report))
    .then(report => {
      if (report.value && report.value.id === '') { report.value.id = id; }
      return report;
    })
    .then(data => this.renderData(data))
  },

  renderFromRange(document, range) {
    if (!Kite) { Kite = require('./kite'); }

    const [start, end] = range;
    const path = hoverPath(document, {
      start: new vscode.Position(start.line, start.character), 
      end: new vscode.Position(end.line, end.character)
    });

    return Plan.queryPlan()
    .then(() => Kite.request({path}))
    .then(report => parseJSON(report))
    .then(data => reportFromHover(data))
    .then(data => this.renderData(data))
    .catch(err => console.log(err.message))
  },

  renderData(data) {
    switch(data.value.kind) {
      case 'module':
      case 'type':
        return renderModule(data);
      case 'function': 
        return renderFunction(data);
      case 'instance': 
      case 'unknown': 
        return renderInstance(data);
      default:
        return '';
    }
  }
}