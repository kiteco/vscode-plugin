const fs = require('fs');
const expect = require('expect.js');
const vscode = require('vscode');
const {fixtureURI, Kite} = require('./helpers');

const {withKite, withKiteRoutes} = require('kite-api/test/helpers/kite');
const {fakeResponse} = require('kite-api/test/helpers/http');


const KiteSignatureProvider = require('../src/signature');

describe('KiteSignatureProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new KiteSignatureProvider(Kite, true);
  });
  withKite({reachable: true}, () => {
    describe('for a python function with a signature', () => {
      withKiteRoutes([
        [
          o => /\/clientapi\/editor\/signatures/.test(o.path),
          o => fakeResponse(200, fs.readFileSync(fixtureURI('plot-signatures.json').toString()))
        ]
      ]);

      it('provides a representation of the function signature', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideSignatureHelp(doc, new vscode.Position(19, 13), null))
        .then(res => {
          expect(res.signatures.length).to.eql(1);
          expect(res.signatures[0].label).to.eql('⟠ plot(x:list|uint64, y:list|str)');
          expect(res.signatures[0].parameters.length).to.eql(2);
          expect(res.signatures[0].parameters[0].label).to.eql('x:list|uint64');
          expect(res.signatures[0].parameters[1].label).to.eql('y:list|str');

          expect(res.activeParameter).to.eql(1);
          expect(res.activeSignature).to.eql(0);
        });
      });
    });

    describe('for a python function with no signature', () => {
      withKiteRoutes([
        [
          o => /\/clientapi\/editor\/signatures/.test(o.path),
          o => fakeResponse(404)
        ]
      ]);

      it('returns null', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideSignatureHelp(doc, new vscode.Position(19, 13), null))
        .then(res => {
          expect(res).to.be(null);
        });
      });
    });
  });
});
