import fs from 'fs';
import expect from 'expect.js';
import vscode from 'vscode';

import { withKite, withKiteRoutes } from 'kite-api/test/helpers/kite';
import { fakeResponse } from 'kite-api/test/helpers/http';

import { fixtureURI, Kite } from './helpers';
import KiteDefinitionProvider from '../src/definition';

describe('KiteDefinitionProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new KiteDefinitionProvider(Kite, true);
  });
  withKite({ reachable: true }, () => {
    describe('when the endpoints returns a definition', () => {
      withKiteRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          () => fakeResponse(200, fs.readFileSync(fixtureURI('test/increment.json').toString()))
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
      withKiteRoutes([
        [
          o => /\/api\/buffer\/vscode\/.*\/hover/.test(o.path),
          () => fakeResponse(404)
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
