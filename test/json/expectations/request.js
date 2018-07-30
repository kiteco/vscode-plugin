'use strict';

const expect = require('expect.js')
const vscode = require('vscode');
const http = require('http');
const KiteAPI = require('kite-api');
const {loadPayload, substituteFromContext, buildContext, itForExpectation} = require('../utils');
const {waitsFor} = require('../../helpers')

let closeMatches;
const getDesc = (expectation) => () => {
  const base = [
    'request to',
    expectation.properties.method,
    expectation.properties.path,
    'in test',
    expectation.description,
  ];

  if(expectation.properties.body) {
    base.push('with');
    base.push(JSON.stringify(substituteFromContext(loadPayload(expectation.properties.body), buildContext())))
  }

  if (closeMatches.length > 0) {
    base.push('\nbut some calls were close');
    closeMatches.forEach(({path, method, payload}) => {
      base.push(`\n - ${method} ${path}`);
      if(expectation.properties.body) {
        base.push(`= ${payload}`);
      }
    });
  } else {
    // console.log(StateController.client.request.getCalls()
    //   .map(({args: [{path, method}, payload]}) => `${method || 'GET'} ${path} '${payload || ''}'`));
    base.push('\nbut no calls were anywhere close');
  }

  return base.join(' ');
};
const getNotDesc = (expectation) => {
  const base = [
    'no request to',
    expectation.properties.method,
    expectation.properties.path,
    'in test',
    expectation.description,
  ];

  if(expectation.properties.body) {
    base.push('with');
    base.push(JSON.stringify(substituteFromContext(loadPayload(expectation.properties.body), buildContext())))
  }

  base.push('\nbut calls were found');

  return base.join(' ');
};

const mostRecentCallMatching = (exPath, exMethod, exPayload, context = {}, env) => {
  const calls = KiteAPI.request.getCalls();
  closeMatches = [];
  let matched = false;

  exPath = substituteFromContext(exPath, context);
  exPayload = exPayload && substituteFromContext(loadPayload(exPayload), context);

  // console.log('--------------------')
  // console.log(exPath, exPayload)

  if (calls.length === 0) { return false; }

  return calls.reverse().reduce((b, c, i, a) => {
    let [{path, method}, payload] = c.args;
    method = method || 'GET';

    // b is false here only if we found a call that partially matches
    // the expected parameters, eg. same endpoint but different method/payload
    // so that mean the most recent call to the expected endpoint is not the one
    // we were looking for, and the assertion must fail immediately
    if (!b || matched) { return b; }

    // console.log(path, method, payload);

    if (path === exPath) {
      if (method === exMethod) {
        closeMatches.push({path, method, payload});
        if (!exPayload || expect.eql(JSON.parse(payload), exPayload)) {
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
  }, true);
};

module.exports = (expectation, not) => {
  beforeEach(function() {
    const promise = waitsFor(getDesc(expectation), () => {
      return mostRecentCallMatching(
        expectation.properties.path,
        expectation.properties.method,
        expectation.properties.body,
        buildContext(),
        this.env);
    }, 300);

    if(not) {
      return promise.then(() => {
        throw new Error(getNotDesc(expectation));
      }, () => {})
    } else {
      return promise;
    }
  });

  itForExpectation(expectation);
};
