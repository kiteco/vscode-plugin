
const vscode = require('vscode');
const jsdom = require('mocha-jsdom');
const expect = require('expect.js');
const KiteRouter = require('../src/router');
const {fixtureURI, withRoutes, withKiteWhitelistedPaths, fakeResponse, Kite} = require('./helpers');

const {hasMembersSection, hasDocsSection, hasHeaderSection, hasExamplesSection, hasLinksSection} = require('./section-helpers');

describe.only('router', () => {
  jsdom();

  let router;
  let source;

  withKiteWhitelistedPaths([__dirname], () => {
    beforeEach(() => {
      router = new KiteRouter();
    })

    describe('member route', () => {
      source = require(fixtureURI('module-os.json'));

      withRoutes([
        [
          o => /\/api\/editor\/symbol\//.test(o.path),
          o => fakeResponse(200, JSON.stringify(source))
        ]
      ])

      beforeEach(() => {
        router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://member/python;json'));
        
        return router.provideTextDocumentContent().then(html => document.body.innerHTML = html);
      });

      hasHeaderSection('os module');

      hasMembersSection(5, source.symbol.value[0].id);

      hasDocsSection(source.report.description_html);

      hasExamplesSection(2, source.symbol.id, source.report.examples);
      
      hasLinksSection(2, source.symbol.id, source.report.links);
    });

    describe('link route', () => {
      source = require(fixtureURI('module-os.json'));

      withRoutes([
        [
          o => /\/api\/editor\/symbol\//.test(o.path),
          o => fakeResponse(200, JSON.stringify(source))
        ]
      ])

      beforeEach(() => {
        router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://link/python;json'));
        
        return router.provideTextDocumentContent().then(html => document.body.innerHTML = html);
      });

      hasHeaderSection('os module');

      hasMembersSection(5, source.symbol.value[0].id);

      hasDocsSection(source.report.description_html);

      hasExamplesSection(2, source.symbol.id, source.report.examples);
      
      hasLinksSection(2, source.symbol.id, source.report.links);
    });
  });
});