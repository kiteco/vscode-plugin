import fs from 'fs';
import expect from 'expect.js';
import vscode from 'vscode';

import { withKite, withKiteRoutes } from 'kite-api/test/helpers/kite';
import { fakeResponse } from 'kite-api/test/helpers/http';

import { fixtureURI, Kite } from './helpers';
import KiteHoverProvider from '../src/hover';

describe('KiteHoverProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new KiteHoverProvider(Kite, true);
  });
  withKite({ reachable: true }, () => {
    describe('for a python function with a definition', () => {
      withKiteRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          () => fakeResponse(200, fs.readFileSync(fixtureURI('test/increment.json').toString()))
        ]
      ]);

      it('provides a definition item', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideHover(doc, new vscode.Position(19, 13), null))
        .then(({ contents }) => {
          expect(contents.length).to.eql(1);
          const contentString = contents[0].value;

          expect(contentString).to.contain('[Docs](command:kite.more-position?{"position":{"line":19,"character":13},"source":"Hover"}');
          expect(contentString).to.contain('[Def](command:kite.def?{"file":"sample.py","line":50,"source":"Hover"})');
        });
      });
    });

    describe('for a python function with no id and no definition', () => {
      withKiteRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          () => fakeResponse(200, fs.readFileSync(fixtureURI('test/increment-no-id-no-def.json').toString()))
        ]
      ]);

      it('does not provide links for web and def', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideHover(doc, new vscode.Position(19, 13), null))
        .then(({ contents }) => {
          expect(contents.length).to.eql(1);
          const contentString = contents[0].value;

          expect(contentString).to.contain('[Docs](command:kite.more-position?{"position":{"line":19,"character":13},"source":"Hover"}');
        });
      });
    });

    describe('for a python module', () => {
      const osjson = fs.readFileSync(fixtureURI('os.json').toString());
      withKiteRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          () => fakeResponse(200, osjson)
        ]
      ]);

      it('displays the proper kind in the hover', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideHover(doc, new vscode.Position(19, 13), null))
        .then(({ contents }) => {
          expect(contents.length).to.eql(1);
          const contentString = contents[0].value;

          expect(contentString).to.contain('[Docs](command:kite.more-position?{"position":{"line":19,"character":13},"source":"Hover"}');

          const data = JSON.parse(osjson);
          for (const value of data["symbol"][0]["value"]){
            expect(contentString).to.contain(["_", value["type"], "_"].join(""));
          }
        });
      });
    });

    describe('for an instance', () => {
      const selfjson = fs.readFileSync(fixtureURI('self.json').toString());
      withKiteRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          () => fakeResponse(200, selfjson)
        ]
      ]);

      it('displays the proper kind in the hover', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideHover(doc, new vscode.Position(19, 13), null))
        .then(({ contents }) => {
          expect(contents.length).to.eql(1);
          const contentString = contents[0].value;

          expect(contentString).to.contain("[Docs](command:kite.more-position");
          expect(contentString).to.contain('"position":{"line":19,"character":13}');

          const data = JSON.parse(selfjson);
          for (const value of data["symbol"][0]["value"]){
            expect(contentString).to.contain(["_", value["type"], "_"].join(""));
          }
        });
      });
    });

    describe('when the endpoint returns a 404', () => {
      withKiteRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          () => fakeResponse(404)
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
