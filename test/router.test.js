
const fs = require('fs');
const vscode = require('vscode');
const jsdom = require('mocha-jsdom');
const expect = require('expect.js');
const KiteRouter = require('../src/router');
const {fixtureURI, withRoutes, withKiteWhitelistedPaths, fakeResponse, Kite} = require('./helpers');

describe('router', () => {
  jsdom();

  let router;

  withKiteWhitelistedPaths([__dirname], () => {
    beforeEach(() => {
      router = new KiteRouter();
    })

    describe('member route', () => {
      withRoutes([
        [
          o => /\/api\/editor\/symbol\//.test(o.path),
          o => fakeResponse(200, fs.readFileSync(fixtureURI('os.json').toString()))
        ]
      ])

      beforeEach(() => {
        router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://member/python;json'));
        
        return router.provideTextDocumentContent().then(html => {
          console.log(html);
        });
      });

      it('renders a member view', () => {

      });
    });
  });
});