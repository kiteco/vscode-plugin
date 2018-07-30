'use strict';

const path = require('path');
const sinon = require('sinon');
const {StateController, Logger} = require('kite-installer');
const Plan = require('../src/plan');
const {promisifyRequest, promisifyReadResponse} = require('../src/utils');
const {withKiteRoutes} = require('kite-api/test/helpers/kite');
const {fakeResponse} = require('kite-api/test/helpers/http');

before(() => {
  sinon.stub(Logger, 'log')
})

const Kite = {
  request(req, data) {
    return promisifyRequest(StateController.client.request(req, data))
    .then(resp => {
      
      if (resp.statusCode !== 200) {
        return promisifyReadResponse(resp).then(data => {
          const err = new Error(`bad status ${resp.statusCode}: ${data}`);
          err.status = resp.statusCode;
          throw err;
        })
      }
      return promisifyReadResponse(resp);
    })
    .catch(err => {
      this.checkState();
      throw err;
    });
  },
}

function waitsFor(m, f, t, i) {
  if (typeof m == 'function' && typeof f != 'function') {
    i = t;
    t = f;
    f = m;
    m = 'something to happen';
  }

  const intervalTime = i || 10;
  const timeoutDuration = t || 2000;

  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (f()) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve();
      }
    }, intervalTime);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      let msg;
      if (typeof m == 'function') {
        msg = `Waited ${timeoutDuration}ms for ${m()}`;
      } else {
        msg = `Waited ${timeoutDuration}ms for ${m} but nothing happened`;
      }
      reject(new Error(msg));
    }, timeoutDuration);
  });
}

function sleep(duration) {
  const t = new Date();
  return waitsFor(`${duration}ms`, () => { return new Date() - t > duration; });
}

function delay(duration, block) {
  return new Promise((resolve) => {
    setTimeout(() => {
      block();
      resolve();
    }, duration);
  });
}


function fixtureURI (filepath) {
  return path.resolve(__dirname, 'fixtures', filepath);
}

function withPlan(description, plan, block) {
  describe(description, () => {
    withKiteRoutes([
      [
        o => o.path.indexOf('/clientapi/plan') === 0,
        o => fakeResponse(200, JSON.stringify(plan)),
      ], [
        o => o.path.indexOf('/clientapi/status') === 0,
        o => fakeResponse(200, JSON.stringify({status: 'ready'})),
      ], [
        o => /^\/api\/account\/user/.test(o.path),
        o => fakeResponse(200, JSON.stringify({email_verified: true})),
      ],
    ]);


    beforeEach(() => Plan.queryPlan());

    block();
  });
}

function withFakePlan(description, plan, block) {
  describe(description, () => {
    beforeEach(() => {
      Plan.plan = plan;
    });

    block();
  });
}

function log(v) {
  console.log(v);
  return v;
}

function formatCall({method, path, payload}) {
  return `${method} ${path} ${payload || ''}`;
}

module.exports = {
  withPlan, withFakePlan,
  sleep, delay, fixtureURI, waitsFor,
  Kite, log, formatCall,
};
