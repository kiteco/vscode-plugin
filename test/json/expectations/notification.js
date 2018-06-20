'use strict';

const sinon = require('sinon');
const vscode = require('vscode');
const {waitsFor} = require('../../helpers')
let stubs;

const LEVELS = {
  info: 'showInformationMessage',
  warning: 'showWarningMessage',
  warn: 'showWarningMessage',
  error: 'showErrorMessage',
}

module.exports = (expectation) => {

  if (!stubs) {
    stubs = [
      sinon.spy(vscode.window, 'showInformationMessage'),
      sinon.spy(vscode.window, 'showWarningMessage'),
      sinon.spy(vscode.window, 'showErrorMessage'),
    ]
  }

  beforeEach(() => {
    const spy = vscode.window[LEVELS[expectation.properties.level]]
    return waitsFor(`${expectation.properties.level} notitication`, () => {
      return spy.callCount > 0;
    })
  });

  if(expectation.focus) {
    it.only(expectation.description, () => {});
  } else {
    it(expectation.description, () => {});
  }
}