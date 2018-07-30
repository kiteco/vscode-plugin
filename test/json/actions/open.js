'use strict';

const vscode = require('vscode');
const path = require('path');
const KiteAPI = require('kite-api');
const {jsonPath} = require('../utils');
const {waitsFor} = require('../../helpers');
const {kite} = require('../../../src/kite');

module.exports = (action) => {
  beforeEach('open action', () => { 
    return vscode.window.showTextDocument(vscode.Uri.file(jsonPath(action.properties.file)))
    .then((editor) => {
      const newPosition = new vscode.Position(0, 0);
      const newSelection = new vscode.Selection(newPosition, newPosition);
      editor.selection = newSelection
      return editor;
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
};
