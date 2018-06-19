'use strict';

const expect = require('expect.js')
const vscode = require('vscode');
const http = require('http');
const {loadResponseForEditor} = require('../utils');
const {waitsFor} = require('../../helpers')
const {StateController} = require('kite-installer')

const mostRecentCallMatching = (exPath, exMethod, exPayload) => {
  const calls = StateController.client.request.getCalls();
  let matched = false;

  if(calls.length === 0) { return false; }

  return calls.reverse().reduce((b, c, i, a) => {
    const [{path, method}, payload] = c.args;

    
    // b is false here only if we found a call that partially matches
    // the expected parameters, eg. same endpoint but different method/payload
    // so that mean the most recent call to the expected endpoint is not the one
    // we were looking for, and the assertion must fail immediately
    if(!b || matched) { return b; }
    
    if(path === exPath) {
      if(method === exMethod) {
        if(expect.eql(JSON.parse(payload), exPayload)) {
          matched = true;
          return true;
        } else {
          return false;
        }
      } else {
        // not the right method = failure
        return false;
      }
    } else {
      // not the good path, we pass up true unless we've reached the first call
      if (i === a.length - 1 && !matched) {
        return false;
      } else {
        return b;
      }
    }
  }, true)
}

module.exports = (expectation) => {
  beforeEach(() => {
    return waitsFor(`request to '${expectation.properties.path}' for test '${expectation.description}'`, () => mostRecentCallMatching(
        expectation.properties.path,
        expectation.properties.method,
        loadResponseForEditor(
          expectation.properties.body,
          vscode.window.activeTextEditor)
      ))
      .catch(err => {
        console.log(err);
        throw err;
      });
  });

  if(expectation.focus) {
    it.only(expectation.description, () => {});
  } else {
    it(expectation.description, () => {});
  }
};
