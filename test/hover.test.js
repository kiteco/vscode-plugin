const fs = require('fs');
const expect = require('expect.js');
const vscode = require('vscode');
const {fixtureURI, Kite} = require('./helpers');

const {withKite, withKiteRoutes} = require('kite-api/test/helpers/kite');
const {fakeResponse} = require('kite-api/test/helpers/http');
const KiteHoverProvider = require('../src/hover');

describe('KiteHoverProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new KiteHoverProvider(Kite, true);
  });
  withKite({reachable: true}, () => {
    describe('for a python function with a definition', () => {
      withKiteRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          o => fakeResponse(200, fs.readFileSync(fixtureURI('test/increment.json').toString()))
        ]
      ]);

      it('provides a definition item', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideHover(doc, new vscode.Position(19, 13), null))
        .then(res => {
          expect(res.contents.length).to.eql(1);

          // TODO(Daniel): Content tests
        });
      });
    });

    describe('for a python function with no id and no definition', () => {
      withKiteRoutes([
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
          expect(res.contents.length).to.eql(1);

          // TODO(Daniel): Content tests
        });
      });
    });

    describe('for a python module', () => {
      withKiteRoutes([
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
          // TODO(Daniel): Fill in tests
        });
      });
    });

    describe('for an instance', () => {
      withKiteRoutes([
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
          // TODO(Daniel): Fill in tests
        });
      });
    });

    describe('when the endpoint returns a 404', () => {
      withKiteRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          o => fakeResponse(404)
        ]
      ]);

      it('returns undefined', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideHover(doc, new vscode.Position(19, 13), null))
        .then(res => {
          expect(res).to.be(undefined);
        });
      });
    });
  });
});
