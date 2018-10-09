'use strict';

const vscode = require('vscode');

let sigCalled = false;
let alphaCompletionCalled = false;
module.exports = ({action}) => {
  afterEach(() => {
    sigCalled = false;
    alphaCompletionCalled = false;
  });
  beforeEach(() => {
    const editor = vscode.window.activeTextEditor;
    if (action.properties.text) {
      const range = new vscode.Range(editor.selection.start, editor.selection.end);
      return editor.edit(builder => {
        console.log('modifying document');
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
        console.log('post edit actions (completions & signature)');
        if(/[ ,.]$/.test(action.properties.text)) {
          alphaCompletionCalled = false;
          vscode.commands.executeCommand('editor.action.triggerSuggest');
        } else if (/\w$/.test(action.properties.text) && !alphaCompletionCalled) {
          alphaCompletionCalled = true;
          vscode.commands.executeCommand('editor.action.triggerSuggest');
        }
        if(/[\(,]$/.test(action.properties.text) || (sigCalled && !/[\)]$/.test(action.properties.text))) {
          sigCalled = true;
          vscode.commands.executeCommand('editor.action.triggerParameterHints');
        }
      })
    }
  });
};
