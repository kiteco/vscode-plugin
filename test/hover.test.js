/* global suite, test */

const fs = require('fs');
const expect = require('expect.js');
const vscode = require('vscode');
const sinon = require('sinon');
const {fixtureURI, withRoutes, withKiteWhitelistedPaths, fakeResponse} = require('./helpers');

const Kite = {
  handle403Response(){}
}

const KiteHoverProvider = require('../src/hover');

describe('KiteHoverProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new KiteHoverProvider(Kite);
  });
  withKiteWhitelistedPaths([__dirname], () => {
    describe('for a python function with an id and a definition', () => {
      withRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          o => fakeResponse(200, fs.readFileSync(fixtureURI('test/increment.json').toString()))
        ]
      ]);

      it('provides a representation of the function with cta links', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideHover(doc, new vscode.Position(19, 13), null))
        .then(res => {
          expect(res.contents.length).to.eql(2);
          expect(res.contents[0].language).to.eql('python');
          expect(res.contents[0].value).to.eql('Test.increment    function');

          expect(res.contents[1]).to.eql(`**Kite:** [web](command:kite.web?{"id":"sample:Test.increment","source":"Hover"}) [more](command:kite.more?{"id":"sample:Test.increment","source":"Hover"}) [def](command:kite.def?{"file":"sample.py","line":50,"source":"Hover"})`);
        });
      });
    });

    describe('for a python function with no id and no definition', () => {
      withRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          o => fakeResponse(200, fs.readFileSync(fixtureURI('test/increment-no-id-no-def.json').toString()))
        ]
      ]);

      it('does not provide links for web and def', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideHover(doc, new vscode.Position(19, 13), null))
        .then(res => {

          expect(res.contents.length).to.eql(2);
          expect(res.contents[1]).to.eql(`**Kite:** [more](command:kite.more-range?{"range":[{"line":19,"character":6},{"line":19,"character":11}],"source":"Hover"})`);
        });
      });
    });

    describe('for a python module', () => {
      withRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          o => fakeResponse(200, fs.readFileSync(fixtureURI('os.json').toString()))
        ]
      ]);

      it('displays the proper kind in the hover', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideHover(doc, new vscode.Position(19, 13), null))
        .then(res => {

          expect(res.contents[0].language).to.eql('python');
          expect(res.contents[0].value).to.eql('os    module');
        });
      });
    });

    describe('for an instance', () => {
      withRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          o => fakeResponse(200, fs.readFileSync(fixtureURI('self.json').toString()))
        ]
      ]);

      it('displays the proper kind in the hover', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideHover(doc, new vscode.Position(19, 13), null))
        .then(res => {

          expect(res.contents[0].language).to.eql('python');
          expect(res.contents[0].value).to.eql('self    instance');
        });
      });
    });

    describe('when the endpoint returns a 404', () => {
      withRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          o => fakeResponse(404)
        ]
      ]);

      it('returns null', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideHover(doc, new vscode.Position(19, 13), null))
        .then(res => {
          expect(res).to.be(null);
        });
      });
    });
  });
});
