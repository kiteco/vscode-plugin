'use strict';

const path = require('path');
const {kite} = require('../src/kite');
const sinon = require('sinon');
const vscode = require('vscode');
const KiteAPI = require('kite-api');
const {jsonPath, walk, describeForTest, featureSetPath} = require('./json/utils');
const {withKite, withKitePaths, withKiteRoutes} = require('kite-api/test/helpers/kite');
const {fakeResponse} = require('kite-api/test/helpers/http');

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
    case 'unsupported':
    case 'not_supported':
      return {supported: false};
    case 'uninstalled':
    case 'not_installed':
      return {installed: false};
    case 'not_running':
      return {running: false};
    case 'unreachable':
    case 'not_reachable':
      return {reachable: false};
    case 'unlogged':
    case 'not_logged':
      return {logged: false};
    default:
      return {supported: false};
  }
}

function pathsSetup(setup) {
  return {
    whitelist: setup.whitelist && setup.whitelist.map(p => jsonPath(p)),
    blacklist: setup.blacklist && setup.blacklist.map(p => jsonPath(p)),
    ignored: setup.ignored && setup.ignored.map(p => jsonPath(p)),
  };
}

const featureSet = require(featureSetPath());

describe('JSON tests', () => {
  featureSet.forEach(feature => {
    walk(jsonPath('tests', feature), (testFile) => {
      buildTest(require(testFile), testFile);
    });
  });
});

function buildTest(data, file) {
  if (data.ignore) {
    return;
  }

  describeForTest(data, `${data.description} ('${file}')`, () => {
    let spy;

    beforeEach('package activation', () => {
      // console.log(`------------------------------------\n start ${data.description}\n------------------------------------`);
      spy = sinon.spy(KiteAPI, 'request');
      kite._activate();
    })
    afterEach('package deactivation', () => {
      spy.restore();
      kite.deactivate();
      
      // console.log(`------------------------------------\n end ${data.description}\n------------------------------------`);
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
