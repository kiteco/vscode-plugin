'use strict';

const expect = require('chai').expect;
const { loadPayload, substituteFromContext, buildContext, itForExpectation, inLiveEnvironment } = require('../utils');
const { waitsFor } = require('../../helpers');
const KiteAPI = require('kite-api');

const callsMatching = (data, exPath, exMethod, exPayload, context={}) => {
  const calls = data || KiteAPI.request.getCalls().map(c => {
    return {
      path: c.args[0].path,
      method: c.args[0].method,
      body: c.args[1],
    };
  });

  exPath = substituteFromContext(exPath, context);
  exPayload = exPayload && substituteFromContext(loadPayload(exPayload), context);

  // console.log('--------------------')
  // console.log(exPath, exPayload)

  if(calls.length === 0) { return false; }

  return calls.reverse().filter((c) => {
    let { path, method, body } = c;
    method = method || 'GET';

    // console.log(path, method, payload)

    return path === exPath && method === exMethod && (!exPayload || expect.eql(JSON.parse(body), exPayload));
  });
};

module.exports = ({ expectation, not, root }) => {
  beforeEach('request count', () => {
    const promise = waitsFor(`${expectation.properties.count} requests to '${expectation.properties.path}' for test '${expectation.description}'`, () => {
      if (inLiveEnvironment()) {
        return KiteAPI.requestJSON({ path: '/testapi/request-history' })
        .then((data) => {
          const calls = callsMatching(
            data,
            expectation.properties.path,
            expectation.properties.method,
            expectation.properties.body,
            buildContext(root));

          if (calls.length !== expectation.properties.count) {
            throw new Error('fail');
          }
        });
      } else {
        const calls = callsMatching(
          null,
          expectation.properties.path,
          expectation.properties.method,
          expectation.properties.body,
          buildContext(root));

        return calls.length === expectation.properties.count;
      }
    }, 3000)
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
          buildContext(root)).length;
        throw new Error(`no ${expectation.properties.count} requests to '${expectation.properties.path}' for test '${expectation.description}' but ${callsCount} were found`);
      }, () => {});
    } else {
      return promise;
    }
  });

  itForExpectation(expectation);
};
