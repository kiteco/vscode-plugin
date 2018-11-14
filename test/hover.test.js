const fs = require('fs');
const expect = require('expect.js');
const vscode = require('vscode');
const {fixtureURI, Kite} = require('./helpers');

const {withKite, withKitePaths, withKiteRoutes} = require('kite-api/test/helpers/kite');
const {fakeResponse} = require('kite-api/test/helpers/http');
const KiteHoverProvider = require('../src/hover');

describe('KiteHoverProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new KiteHoverProvider(Kite, true);
  });
  withKite({logged: true}, () => {
    withKitePaths({whitelist: [__dirname]}, undefined, () => {
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
            expect(res.contents.length).to.eql(2);
            expect(res.contents[0].language).to.eql('python');
            expect(res.contents[0].value).to.eql('Test.increment    function');

            expect(res.contents[1].value).to.eql(`**Kite:** [docs](command:kite.more-position?{&quot;position&quot;:{&quot;line&quot;:19,&quot;character&quot;:13},&quot;source&quot;:&quot;Hover&quot;}) [def](command:kite.def?{&quot;file&quot;:&quot;sample.py&quot;,&quot;line&quot;:50,&quot;source&quot;:&quot;Hover&quot;})`);
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

            expect(res.contents.length).to.eql(2);
            expect(res.contents[1].value).to.eql(`**Kite:** [docs](command:kite.more-position?{&quot;position&quot;:{&quot;line&quot;:19,&quot;character&quot;:13},&quot;source&quot;:&quot;Hover&quot;})`);
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

            expect(res.contents[0].language).to.eql('python');
            expect(res.contents[0].value).to.eql('os    module');
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

            expect(res.contents[0].language).to.eql('python');
            expect(res.contents[0].value).to.eql('self    instance');
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
});
