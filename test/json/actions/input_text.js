'use strict';

const vscode = require('vscode');

module.exports = (action) => {
  beforeEach(() => {
    const editor = vscode.window.activeTextEditor;
    if (action.properties.text) {
      const range = new vscode.Range(editor.selection.start, editor.selection.end);
      return editor.edit(builder => {
        if (action.properties.offset) {
          const {line, character} = editor.document.positionAt(action.properties.offset);
    
          const position = new vscode.Position(line, character);
          builder.insert(position, action.properties.text);
        } else if(range.isEmpty) {
          builder.insert(editor.selection.end, action.properties.text);
        } else {
          builder.replace(range, action.properties.text);
        }
      })
      .then(() => {
        if(/[\w]$/.test(action.properties.text)) {
          vscode.commands.executeCommand('editor.action.triggerSuggest')
        }
      })
    }
  });
};
