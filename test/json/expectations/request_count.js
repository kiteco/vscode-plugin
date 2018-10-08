'use strict';

const expect = require('expect.js')
const vscode = require('vscode');
const http = require('http');
const {loadPayload, substituteFromContext, buildContext, itForExpectation} = require('../utils');
const {waitsFor} = require('../../helpers')
const KiteAPI = require('kite-api');

const callsMatching = (exPath, exMethod, exPayload, context={}) => {
  const calls = KiteAPI.request.getCalls();

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

module.exports = (expectation, not) => {
  beforeEach(() => {
    const promise = waitsFor(`${expectation.properties.count} requests to '${expectation.properties.path}' for test '${expectation.description}'`, () => {
        const calls = callsMatching(
          expectation.properties.path,
          expectation.properties.method,
          expectation.properties.body,
          buildContext(vscode.window.activeTextEditor));
          
        return calls.length === expectation.properties.count;
      }, 300)
      .catch(err => {
        console.log(err);
        throw err;
      });

    if(not) {
      return promise.then(() => {
        const callsCount = callsMatching(
          expectation.properties.path,
          expectation.properties.method,
          expectation.properties.body,
          buildContext(vscode.window.activeTextEditor)).length;
        throw new Error(`no ${expectation.properties.count} requests to '${expectation.properties.path}' for test '${expectation.description}' but ${callsCount} were found`);
      }, () => {})
    } else {
      return promise;
    }
  });

  itForExpectation(expectation);
};
