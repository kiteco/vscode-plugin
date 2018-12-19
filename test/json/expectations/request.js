'use strict';

const expect = require('expect.js')
const vscode = require('vscode');
const http = require('http');
const KiteAPI = require('kite-api');
const KiteConnect = require('kite-connector');
const {loadPayload, substituteFromContext, buildContext, itForExpectation, inLiveEnvironment} = require('../utils');
const {waitsFor, formatCall} = require('../../helpers')

let closeMatches, calls;
const getDesc = (expectation, root) => () => {
  const base = [
    'request to',
    expectation.properties.method,
    expectation.properties.path,
    'in test',
    expectation.description,
  ];

  if(expectation.properties.body) {
    base.push('with');
    base.push(JSON.stringify(substituteFromContext(loadPayload(expectation.properties.body), buildContext(root))))
  }

  if (closeMatches.length > 0) {
    base.push('\nbut some calls were close');
    closeMatches.forEach((call) => {
      base.push(`\n - ${formatCall(call)}`)
    });
  } else {
    //   .map(({args: [{path, method}, payload]}) => `${method || 'GET'} ${path} '${payload || ''}'`));
    base.push(`\nbut no calls were anywhere close\n${KiteAPI.request.getCalls().map(c => {
      let [{path, method}, payload] = c.args;
      method = method || 'GET';

      return `- ${formatCall({path, method, payload})}`
    }).join('\n')}`);
  }

  return base.join(' ');
};
const getNotDesc = (expectation, root) => {
  const base = [
    'no request to',
    expectation.properties.method,
    expectation.properties.path,
    'in test',
    expectation.description,
  ];

  if(expectation.properties.body) {
    base.push('with');
    base.push(JSON.stringify(substituteFromContext(loadPayload(expectation.properties.body), buildContext(root))))
  }

  base.push('\nbut calls were found');

  return base.join(' ');
};

const mostRecentCallMatching = (data, exPath, exMethod, exPayload, context = {}, env) => {
  const calls = data || KiteAPI.request.getCalls().map(c => {
    return {
      path: c.args[0].path,
      method: c.args[0].method,
      body: c.args[1],
    };
  });
  closeMatches = [];
  let matched = false;

  exPath = substituteFromContext(exPath, context);
  exPayload = exPayload && substituteFromContext(loadPayload(exPayload), context);

  // console.log('--------------------')
  // console.log(exPath, exPayload)

  if (calls.length === 0) { return false; }

  return calls.reverse().reduce((b, c, i, a) => {
    let {path, method, body} = c;
    method = method || 'GET';

    // b is false here only if we found a call that partially matches
    // the expected parameters, eg. same endpoint but different method/payload
    // so that mean the most recent call to the expected endpoint is not the one
    // we were looking for, and the assertion must fail immediately
    if (!b || matched) { return b; }

    // console.log(path, method, payload);

    if (path === exPath) {
      if (method === exMethod) {
        closeMatches.push({path, method, body});
        if (!exPayload || expect.eql(JSON.parse(body), exPayload)) {
          matched = true;
          return true;
        } else {
          return b;
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

module.exports = ({expectation, not, root}) => {
  beforeEach('request matching', function() {
    const promise = waitsFor(getDesc(expectation, root), () => {
      if (inLiveEnvironment()) {
        return KiteAPI.requestJSON({path: '/testapi/request-history'})
        .then((data) => {
          if (!mostRecentCallMatching(
            data,
            expectation.properties.path,
            expectation.properties.method,
            expectation.properties.body,
            buildContext(root),
            this.env)) {
            throw new Error('fail');
          }
        });
      } else {
        return mostRecentCallMatching(
          null,
          expectation.properties.path,
          expectation.properties.method,
          expectation.properties.body,
          buildContext(root),
          this.env);
      }
    }, 3000);

    if(not) {
      return promise.then(() => {
        throw new Error(getNotDesc(expectation, root));
      }, () => {})
    } else {
      return promise;
    }
  });

  itForExpectation(expectation);
};
