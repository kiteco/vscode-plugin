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
    describe('for a python function', () => {
      withRoutes([
        [
          o => o.path.indexOf() !== -1,
          o => fakeResponse(200, fs.readFileSync(fixtureURI('test/increment.json').toString()))
        ]
      ]);

      it('provides a representation of the function', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideHover(doc, new vscode.Position(19, 13), null))
        .then(res => {
          expect(res.contents.length).to.eql(2);
          expect(res.contents[0].language).to.eql('python');
          expect(res.contents[0].value).to.eql('Test.increment');
        });
      });
    });
  });
});
