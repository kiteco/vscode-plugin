const fs = require('fs');
const expect = require('expect.js');
const vscode = require('vscode');
const {fixtureURI, withRoutes, withKiteWhitelistedPaths, fakeResponse, Kite} = require('./helpers');

const KiteHoverProvider = require('../src/hover');

describe('KiteHoverProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new KiteHoverProvider(Kite, true);
  });
  withKiteWhitelistedPaths([__dirname], () => {
    describe('for a python function with a definition', () => {
      withRoutes([
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

          expect(res.contents[1].value).to.eql(`**Kite:** [web](command:kite.web?{&quot;id&quot;:&quot;sample:Test.increment&quot;,&quot;source&quot;:&quot;Hover&quot;}) [more](command:kite.more-position?{&quot;position&quot;:{&quot;line&quot;:19,&quot;character&quot;:13},&quot;source&quot;:&quot;Hover&quot;}) [def](command:kite.def?{&quot;file&quot;:&quot;sample.py&quot;,&quot;line&quot;:50,&quot;source&quot;:&quot;Hover&quot;})`);
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
          expect(res.contents[1].value).to.eql(`**Kite:** [more](command:kite.more-position?{&quot;position&quot;:{&quot;line&quot;:19,&quot;character&quot;:13},&quot;source&quot;:&quot;Hover&quot;})`);
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
