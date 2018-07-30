'use strict';

const path = require('path');
const {kite} = require('../src/kite');
const sinon = require('sinon');
const vscode = require('vscode');
const KiteAPI = require('kite-api');
const {jsonPath, walk, describeForTest} = require('./json/utils');
const {StateController} = require('kite-installer');
const {withKite, withKitePaths, withKiteRoutes} = require('kite-api/test/helpers/kite');
const {fakeResponse} = require('kite-api/test/helpers/http');
const {sleep} = require('./helpers');

const ACTIONS = {};
const EXPECTATIONS = {};

walk(path.resolve(__dirname, 'json', 'actions'), '.js', file => {
  const key = path.basename(file).replace(path.extname(file), '');
  ACTIONS[key] = require(file);
});

walk(path.resolve(__dirname, 'json', 'expectations'), '.js', file => {
  const key = path.basename(file).replace(path.extname(file), '');
  EXPECTATIONS[key] = require(file);
});

function kiteSetup(setup) {
  switch (setup) {
    case 'authenticated':
      return {logged: true};
    default:
      return {};
  }
}

function pathsSetup(setup) {
  return {
    whitelist: setup.whitelist && setup.whitelist.map(jsonPath),
    blacklist: setup.blacklist && setup.blacklist.map(jsonPath),
    ignored: setup.ignored && setup.ignored.map(jsonPath),
  };
}

describe('JSON tests', () => {
  let stub;
  beforeEach(() => {
    stub = sinon.spy(KiteAPI, 'request');
  })
  afterEach(() => {
    stub.restore();
    sleep(100);
  })
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

    withKite(kiteSetup(data.setup.kited), () => {
      withKitePaths(pathsSetup(data.setup), undefined, () => {
        withKiteRoutes([
          [o => o.path === '/clientapi/plan', o => fakeResponse(200, '{}')]
        ])
        data.test.reverse().reduce((f, s) => {
          switch (s.step) {
            case 'action':
              return buildAction(s, f);
            case 'expect':
              return buildExpectation(s, f);
            case 'expect_not':
              return buildExpectation(s, f, true);
            default:
              return f;
          }
        }, () => {})();
      });
    });
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

function buildExpectation(expectation, block, not) {
  return () => {
  
    EXPECTATIONS[expectation.type] && EXPECTATIONS[expectation.type](expectation, not);
  
    describe('', () => {
      block && block();
    })
  };
}
