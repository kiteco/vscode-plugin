'use strict';

const vscode = require('vscode');

module.exports = (action) => {
  beforeEach(() => {
    const editor = vscode.window.activeTextEditor;
    if (action.properties.text) {
      const range = new vscode.Range(editor.selection.start, editor.selection.end);
      return editor.edit(builder => {
        if(range.isEmpty) {
          builder.insert(editor.selection.end, action.properties.text);
        } else {
          builder.replace(range, action.properties.text);
        }
      })
    }
  });
};
