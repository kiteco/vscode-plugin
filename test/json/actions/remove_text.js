'use strict';

const vscode = require('vscode');

module.exports = ({action}) => {
  beforeEach(() => {
    const editor = vscode.window.activeTextEditor;

    const range = new vscode.Range(
      editor.document.positionAt(action.properties.to_offset), 
      editor.document.positionAt(action.properties.from_offset));

    return editor.edit(builder => {
      builder.replace(range, '');
    })
    .then(() => {
      // if(/[\(,]$/.test(action.properties.text)) {
      //   vscode.commands.executeCommand('editor.action.triggerParameterHints');
      // }
    })

  });
};
