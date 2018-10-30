'use strict';

const vscode = require('vscode');
const path = require('path');
const KiteAPI = require('kite-api');
const {waitsFor} = require('../../helpers');

module.exports = ({action, root}) => {
  beforeEach('new file action', () => { 
    return vscode.window.showTextDocument(vscode.Uri.parse('untitled:' + path.join(root(), action.properties.file)))
    .then((editor) => {
      return editor;
    })
    .then(editor => {
      let editBuilder = textEdit => {
        textEdit.insert(new vscode.Position(0, 0), action.properties.content);
      };

      return editor.edit(editBuilder, {
        undoStopBefore: true,
        undoStopAfter: false
      })
      .then(() => editor);
    })
    .then((editor) => 
      /\.py$/.test(path.extname(editor.document.fileName)) && 
      waitsFor(`kite editor focus event`, () => 
        KiteAPI.request.getCalls().some(c => c.args[0].path === '/clientapi/editor/event' && /"(focus|skip)"/.test(c.args[1]))
      ), err => {
        console.log(err)
      })
    // .then(() => console.log('kite editor found for file'))
  });

  afterEach(() => { 
    return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  })
};
