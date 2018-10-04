'use strict';

const vscode = require('vscode');

module.exports = (action) => {
  beforeEach(() => {
    const editor = vscode.window.activeTextEditor;
    console.log(editor);
    if (action.properties.offset) {
      const {line, character} = editor.document.positionAt(action.properties.offset);

      const newPosition = new vscode.Position(line, character);
      const newSelection = new vscode.Selection(newPosition, newPosition);
      editor.selection = newSelection;
    }
  });
};
