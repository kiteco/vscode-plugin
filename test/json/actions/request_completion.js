'use strict';

const vscode = require('vscode');

module.exports = () => {
  beforeEach('requesting completions', () => {
    vscode.commands.executeCommand('editor.action.triggerSuggest');
  })
}
