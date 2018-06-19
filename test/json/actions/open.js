'use strict';

const vscode = require('vscode');
const {jsonPath} = require('../utils');

module.exports = (action) => {
  beforeEach(() => { 
    return vscode.window.showTextDocument(vscode.Uri.file(jsonPath(action.properties.file)))
    .then((editor) => {
      const newPosition = new vscode.Position(0, 0);
      const newSelection = new vscode.Selection(newPosition, newPosition);
      editor.selection = newSelection
    })
  });
};
