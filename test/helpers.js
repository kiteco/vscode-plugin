'use strict';

const path = require('path');
const sinon = require('sinon');
const {Logger} = require('kite-installer');
const Plan = require('../src/plan');
const KiteAPI = require('kite-api');
const {withKiteRoutes} = require('kite-api/test/helpers/kite');
const {fakeResponse} = require('kite-api/test/helpers/http');

before(() => {
  sinon.stub(Logger, 'log')
})

const Kite = {
  request(req, data) {
    return KiteAPI.request(req, data);
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
