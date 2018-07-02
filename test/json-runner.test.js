'use strict';

const path = require('path');
const {kite} = require('../src/kite');
const sinon = require('sinon');
const vscode = require('vscode');
const {jsonPath, walk, describeForTest} = require('./json/utils');
const {StateController} = require('kite-installer');
const {withKiteAuthenticated, withKiteWhitelistedPaths, withKiteBlacklistedPaths, sleep} = require('./helpers');

const ACTIONS = {};
const EXPECTATIONS = {};
const STATES = {
  authenticated: withKiteAuthenticated,
};

walk(path.resolve(__dirname, 'json', 'actions'), '.js', file => {
  const key = path.basename(file).replace(path.extname(file), '');
  ACTIONS[key] = require(file);
});

walk(path.resolve(__dirname, 'json', 'expectations'), '.js', file => {
  const key = path.basename(file).replace(path.extname(file), '');
  EXPECTATIONS[key] = require(file);
});

describe.only('JSON tests', () => {
  afterEach(() => sleep(100))
  walk(jsonPath('tests'),  '.json', (testFile) => {
    buildTest(require(testFile), testFile);
  });
});

function buildTest(data, file) {
  if (data.ignore) {
    return;
  }

  describeForTest(data, `${data.description} ('${file}')`, () => {
    let spy;

    beforeEach(() => {
      spy = sinon.spy(StateController.client, 'request');
      kite._activate();
      // console.log('start ------------------------------------')
    })
    afterEach(() => {
      spy.restore();
      kite.deactivate();
      
      // console.log('end ------------------------------------')
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
      if(data.setup.kited === 'authenticated' && data.setup.blacklist) {
        withKiteBlacklistedPaths(data.setup.blacklist.map(p => jsonPath(p)));
      }

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
      withKiteWhitelistedPaths(data.setup.whitelist.map(p => jsonPath(p)), block)
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
