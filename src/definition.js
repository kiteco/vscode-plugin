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
    const range = document.getWordRangeAtPosition(position);
    const path = hoverPath(document, range);
    return promisifyRequest(StateController.client.request({path}))
    .then(resp => {
      this.Kite.handle403Response(document, resp);
      Logger.logResponse(resp);
      if (resp.statusCode !== 200) {
        throw new Error(`${resp.statusCode} status at ${path}`);
      }
      return promisifyReadResponse(resp);
    })
    .then(data => parseJSON(data))
    .then(data => {
      if (data && data.report && data.report.definition) {
        return new Location(
          vscode.Uri.file(data.report.definition.filename), 
          new Position(data.report.definition.line, 0));
      }
    })
    .catch(err => {
      console.error(err);
    });
  }
}