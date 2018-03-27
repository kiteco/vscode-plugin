const fs = require('fs');
const expect = require('expect.js');
const vscode = require('vscode');
const {fixtureURI, withRoutes, withKiteWhitelistedPaths, fakeResponse, Kite} = require('./helpers');

const KiteCompletionProvider = require('../src/completion');

describe('KiteCompletionProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new KiteCompletionProvider(Kite, true);
  });
  withKiteWhitelistedPaths([__dirname], () => {
    describe('when the endpoints returns some completions', () => {
      withRoutes([
        [
          o => /\/clientapi\/editor\/completions/.test(o.path),
          o => fakeResponse(200, fs.readFileSync(fixtureURI('completions.json').toString()))
        ]
      ]);

      it('provides them as suggestions ', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideCompletionItems(doc, new vscode.Position(19, 13)))
        .then(res => {
          expect(res.length).to.eql(2);

          expect(res[0].label).to.eql('dumps');
          expect(res[0].insertText).to.eql('idumps');
          expect(res[0].sortText).to.eql('0');

          expect(res[1].label).to.eql('dump');
          expect(res[1].insertText).to.eql('idump');
          expect(res[1].sortText).to.eql('1');
        });
      });
    });

    describe('when the endpoint responds with a 404', () => {
      withRoutes([
        [
          o => /\/clientapi\/editor\/completions/.test(o.path),
          o => fakeResponse(404)
        ]
      ]);

      it('returns null', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideCompletionItems(doc, new vscode.Position(19, 13)))
        .then(res => {
          expect(res).to.eql([]);
        });
      });
    });
  });
});
