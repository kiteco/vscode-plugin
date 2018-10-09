'use strict';

const vscode = require('vscode');
const {kite: Kite} = require('../../../src/kite');
const KiteHoverProvider = require('../../../src/hover');

module.exports = () => {
  beforeEach(() => {
    const editor = vscode.window.activeTextEditor;
    KiteHoverProvider.prototype.provideHover.call({Kite}, editor.document, editor.selection.active)
  })
}