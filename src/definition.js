'use strict';

const vscode = require('vscode');
const {Location, Position} = vscode;
const {editorsForDocument, parseJSON, promisifyReadResponse} = require('./utils');
const {hoverPath} = require('./urls');

module.exports = class KiteDefinitionProvider {
  constructor(Kite, isTest) {
    this.Kite = Kite;
    this.isTest = isTest;
  }

  provideDefinition(document, position, token) {
    // hueristic - based on how editors are registered for whitelisting based on
    // documents, it should be sufficient to see if just one passes the check below
    if (this.isTest || editorsForDocument(document).some(e => this.Kite.isEditorWhitelisted(e))) {
      const path = hoverPath(document, position);
      return this.Kite.request({path}, null, document)
      .then(resp => promisifyReadResponse(resp))
      .then(data => parseJSON(data))
      .then(data => {
        if (data && data.report && data.report.definition && data.report.definition.filename !== '') {
          return new Location(
            vscode.Uri.file(data.report.definition.filename), 
            new Position(data.report.definition.line - 1, 0));
        }
      })
      .catch(() => null);
    } else {
      return Promise.resolve(null);
    }
  }
}