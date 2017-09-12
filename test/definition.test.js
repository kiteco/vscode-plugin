const fs = require('fs');
const expect = require('expect.js');
const vscode = require('vscode');
const {fixtureURI, withRoutes, withKiteWhitelistedPaths, fakeResponse, Kite} = require('./helpers');

const KiteDefinitionProvider = require('../src/definition');

describe('KiteDefinitionProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new KiteDefinitionProvider(Kite);
  });
  withKiteWhitelistedPaths([__dirname], () => {
    describe('when the endpoints returns a definition', () => {
      withRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          o => fakeResponse(200, fs.readFileSync(fixtureURI('test/increment.json').toString()))
        ]
      ]);

      it('provides the uri and range', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideDefinition(doc, new vscode.Position(19, 13), null))
        .then(res => {
          expect(res.uri.path).to.eql('/sample.py');
          expect(res.range.start.line).to.eql(49);
          expect(res.range.start.character).to.eql(0);
          expect(res.range.end.line).to.eql(49);
          expect(res.range.end.character).to.eql(0);
        });
      });
    });

    describe('when the endpoint responds with a 404', () => {
      withRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          o => fakeResponse(404)
        ]
      ]);

      it('returns null', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideDefinition(doc, new vscode.Position(19, 13), null))
        .then(res => {
          expect(res).to.eql(null);
        });
      });
    });
  });
});
