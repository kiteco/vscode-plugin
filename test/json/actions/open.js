'use strict';

const fs = require('fs-plus');
const path = require('path');
const vscode = require('vscode');
const KiteAPI = require('kite-api');
const {jsonPath} = require('../utils');
const {waitsFor} = require('../../helpers');

module.exports = ({action, root}) => {
  beforeEach('open action', () => {
    const filename = path.join(root(), action.properties.file);

    return new Promise((resolve, reject) => {
      fs.makeTree(path.dirname(filename), (err) => {
        if (err) {
          return reject(err);
        }

        fs.copyFile(jsonPath(action.properties.file), filename, (err) => {
          if(err) {
            return reject(err);
          }

          resolve();
        });
      })
    })
    .then(() => vscode.window.showTextDocument(vscode.Uri.file(filename)))

    .then((editor) =>
      /\.py$/.test(path.extname(editor.document.fileName)) &&
      waitsFor(`kite editor focus event`, () =>
        KiteAPI.request.getCalls().some(c => c.args[0].path === '/clientapi/editor/event' && /"(focus|skip)"/.test(c.args[1]))
      ), err => {
        console.log(err)
      })
    // .then(() => console.log('kite editor found for file'))
  });
  afterEach('close action', () => { 
    return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  })
};
