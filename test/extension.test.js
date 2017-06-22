/* global suite, test */

const assert = require('assert');
const vscode = require('vscode');
const sinon = require('sinon');

const Kite = require('../src/kite');

function insertSomeText (text) {
  return vscode.window.activeTextEditor.edit(function (editBuilder) {
    let position = new vscode.Position(0, 0);
    editBuilder.insert(position, text);
  });
}
