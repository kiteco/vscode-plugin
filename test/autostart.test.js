'use strict';

const expect = require('expect.js');
const kite = require('../src/kite');
const sinon = require('sinon');
const vscode = require('vscode');
const KiteAPI = require('kite-api');
const { withKite } = require('kite-api/test/helpers/kite');
const { waitsFor } = require('./helpers');

withKite({ running: false }, () => {
  let spy, spy2;

  describe('when startKiteAtStartup is disabled', () => {
    beforeEach('package activation', () => {
      spy2 = sinon.stub(vscode.workspace, 'getConfiguration').callsFake((conf) => {
        return {
          startKiteAtStartup: false,
          loggingLevel: 'info',
          get(key) {
            return this[key];
          }
        };
      });
      spy = sinon.spy(KiteAPI, 'runKiteAndWait');
      kite.activate({ globalState: {}});
    });

    afterEach('package deactivation', () => {
      spy.restore();
      spy2.restore();
      kite.deactivate();
    });

    it('does not start kited', () => {
      return expect(KiteAPI.runKiteAndWait.called).not.to.be.ok();
    });
  });

  describe('when startKiteEngineOnStartup is enabled', () => {
    beforeEach('package activation', () => {
      spy2 = sinon.stub(vscode.workspace, 'getConfiguration').callsFake((conf) => {
        return {
          startKiteEngineOnStartup: true,
          loggingLevel: 'info',
          get(key) {
            return this[key];
          }
        };
      });
      spy = sinon.spy(KiteAPI, 'runKiteAndWait');
      kite.activate({ globalState: {}});
    });

    afterEach('package deactivation', () => {
      spy.restore();
      spy2.restore();
      kite.deactivate();
    });

    it('starts kited', () => {
      return waitsFor(() => KiteAPI.runKiteAndWait.getCalls().length > 0);
    });
  });
});
