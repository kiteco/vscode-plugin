'use strict';

const vscode = require('vscode');

module.exports = () => {
  beforeEach(() => {
    vscode.commands.executeCommand('editor.action.triggerSuggest');
  })
}