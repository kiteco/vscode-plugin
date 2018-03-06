'use strict';

const vscode = require('vscode');
const {Location, Position} = vscode;
const {StateController, Logger} = require('kite-installer');
const {promisifyRequest, promisifyReadResponse, parseJSON} = require('./utils');
const {hoverPath} = require('./urls');

module.exports = class KiteDefinitionProvider {
  constructor(Kite) {
    this.Kite = Kite;
  }

  provideDefinition(document, position, token) {
    const path = hoverPath(document, position);
    return this.Kite.request({path}, null, document)
    .then(data => parseJSON(data))
    .then(data => {
      if (data && data.report && data.report.definition && data.report.definition.filename !== '') {
        return new Location(
          vscode.Uri.file(data.report.definition.filename), 
          new Position(data.report.definition.line - 1, 0));
      }
    })
    .catch(() => null);
  }
}