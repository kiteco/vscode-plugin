import fs from 'fs';
import vscode from 'vscode';

import { expect } from 'chai';
import { withKite, withKiteRoutes } from 'kite-api/test/helpers/kite';
import { fakeResponse } from 'kite-api/test/helpers/http';

import { fixtureURI, Kite } from './helpers';
import KiteCompletionProvider from '../src/completion';

const mockWindow = {
  activeTextEditor: {
    selection: new vscode.Selection(new vscode.Position(19, 13), new vscode.Position(19,13))
  }
};

describe('KiteCompletionProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new KiteCompletionProvider(Kite, ['a'], ['('], mockWindow);
  });
  withKite({ reachable: true }, () => {
    describe('when the endpoints returns some completions', () => {
      withKiteRoutes([
        [
          o => /\/clientapi\/editor\/complete/.test(o.path),
          () => fakeResponse(200, fs.readFileSync(fixtureURI('completions.json').toString()))
        ]
      ]);

      it('provides them as suggestions ', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideCompletionItems(doc, new vscode.Position(19, 13), null, { triggerCharacter: '' }))
        .then(({ items }) => {
          expect(items.length).to.eql(2);

          expect(items[0].label).to.eql('json.dumps');
          expect(items[0].insertText).to.eql('dumps');
          expect(items[0].sortText).to.eql('0');

          expect(items[1].label).to.contain('json.dumps(「obj」)');
          expect(items[1].insertText.value).to.eql('dumps(${1:「obj」})$0');
          expect(items[1].sortText).to.eql('1');
        });
      });
    });

    describe('when the endpoint responds with a 404', () => {
      withKiteRoutes([
        [
          o => /\/clientapi\/editor\/completions/.test(o.path),
          () => fakeResponse(404)
        ]
      ]);

      it('returns empty array', () => {
        const uri = vscode.Uri.file(fixtureURI('sample.py'));

        return vscode.workspace.openTextDocument(uri)
        .then(doc => provider.provideCompletionItems(doc, new vscode.Position(19, 13), null, { triggerCharacter: '' }))
        .then(res => {
          expect(res).to.eql([]);
        });
      });
    });
  });
});
