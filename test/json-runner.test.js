'use strict';

const path = require('path');
const {kite} = require('../src/kite');
const sinon = require('sinon');
const vscode = require('vscode');
const {jsonPath, walk} = require('./json/utils');
const {StateController} = require('kite-installer');
const {withKiteAuthenticated, withKiteWhitelistedPaths} = require('./helpers');

const ACTIONS = {};
const EXPECTATIONS = {};
const STATES = {
  authenticated: withKiteAuthenticated,
};

walk(jsonPath('actions'), file => {
  const key = path.basename(file).replace(path.extname(file), '');
  ACTIONS[key] = require(file);
});

walk(jsonPath('expectations'), file => {
  const key = path.basename(file).replace(path.extname(file), '');
  EXPECTATIONS[key] = require(file);
});

describe.only('JSON tests', () => {
  walk(jsonPath('tests'), (testFile) => {
    buildTest(require(testFile));
  });
});

function buildTest(data) {
  describe(data.description, () => {
    let spy;

    beforeEach(() => {
      spy = sinon.spy(StateController.client, 'request');
      kite._activate();
    })
    afterEach(() => {
      spy.restore();
      kite.deactivate();

      return clearWorkspace();
      function clearWorkspace() {
        if(vscode.window.activeTextEditor) {
          return vscode.commands.executeCommand('workbench.action.closeActiveEditor').then(clearWorkspace);
        } else {
          return;
        }
      }
    })

    const block = () => {
      data.test.reverse().reduce((f, s) => {
        switch (s.step) {
          case 'action':
            return buildAction(s, f);
          case 'expect':
            return buildExpectation(s, f);
          default:
            return f;
        }
      }, () => {})();
    }
    if(data.setup.kited === 'authenticated' && data.setup.whitelist) {
      withKiteWhitelistedPaths(data.setup.whitelist, block)
    } else {
      STATES[data.setup.kited](block);
    }
  });
}

function buildAction(action, block) {
  return () => describe(action.description, () => {
    ACTIONS[action.type] && ACTIONS[action.type](action);

    describe('', () => {
      block && block();
    });
  });
}

function buildExpectation(expectation, block) {
  return () => {
  
    EXPECTATIONS[expectation.type] && EXPECTATIONS[expectation.type](expectation);
  
    describe('', () => {
      block && block();
    })
  };
}
