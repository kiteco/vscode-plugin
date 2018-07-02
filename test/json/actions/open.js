'use strict';

const vscode = require('vscode');
const path = require('path');
const {jsonPath} = require('../utils');
const {waitsFor} = require('../../helpers');
const {kite} = require('../../../src/kite');

module.exports = (action) => {
  beforeEach(() => { 
    return vscode.window.showTextDocument(vscode.Uri.file(jsonPath(action.properties.file)))
    .then((editor) => {
      const newPosition = new vscode.Position(0, 0);
      const newSelection = new vscode.Selection(newPosition, newPosition);
      editor.selection = newSelection
      return editor;
    })
    .then((editor) => 
      /\.py$/.test(path.extname(editor.document.fileName)) && 
      waitsFor(`kite editor for ${editor.document.fileName}`, () => 
        kite.kiteEditorByEditor.get(editor.document.fileName), 300))
    // .then(() => console.log('kite editor found for file'))
  });
};
