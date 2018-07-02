'use strict';

const expect = require('expect.js')
const vscode = require('vscode');
const http = require('http');
const {loadPayload, substituteFromContext, buildContextForEditor, itForExpectation} = require('../utils');
const {waitsFor} = require('../../helpers')
const {StateController} = require('kite-installer')

const callsMatching = (exPath, exMethod, exPayload, context={}) => {
  const calls = StateController.client.request.getCalls();

  exPath = substituteFromContext(exPath, context) 
  exPayload = exPayload && substituteFromContext(loadPayload(exPayload), context);

  // console.log('--------------------')
  // console.log(exPath, exPayload)

  if(calls.length === 0) { return false; }

  return calls.reverse().filter((c) => {
    let [{path, method}, payload] = c.args;
    method = method || 'GET'
    
    // console.log(path, method, payload)
    
    return path === exPath && method === exMethod && (!exPayload || expect.eql(JSON.parse(payload), exPayload))
  });
}

module.exports = (expectation) => {
  beforeEach(() => {
    return waitsFor(`${expectation.properties.count} requests to '${expectation.properties.path}' for test '${expectation.description}'`, () => {
        const calls = callsMatching(
          expectation.properties.path,
          expectation.properties.method,
          expectation.properties.body,
          buildContextForEditor(vscode.window.activeTextEditor));
          // console.log(calls.length);
          
        return calls.length === expectation.properties.count;
      }, 300)
      .catch(err => {
        console.log(err);
        throw err;
      });
  });

  itForExpectation(expectation);
};
