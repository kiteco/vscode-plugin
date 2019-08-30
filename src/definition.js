'use strict';

const vscode = require('vscode');
const { Location, Position } = vscode;
const { editorsForDocument, parseJSON, promisifyReadResponse } = require('./utils');
const { hoverPath } = require('./urls');

module.exports = class KiteDefinitionProvider {
  constructor(Kite, isTest) {
    this.Kite = Kite;
    this.isTest = isTest;
  }

  provideDefinition(document, position, token) {
    // No-op if Microsoft Python ext is installed.
    // Putting it here instead of kite.js since the ext can be installed and activated
    // without a restart.
    const msPythonExt = vscode.extensions.getExtension("ms-python.python");
    if (msPythonExt) {
      return;
    }
    const path = hoverPath(document, position);
    return this.Kite.request({ path }, null, document)
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