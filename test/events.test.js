'use strict';

const expect = require('expect.js');
const sinon = require('sinon');
const EditorEvents = require('../src/events');
const vscode = require('vscode');
const {fixtureURI} = require('./helpers');

describe('EditorEvents', () => {
  let editor, events, Kite;

  beforeEach(() => {
    // We're going to fake most objects that are used by the editor events
    // because of how VSCode testing environment works. 
    // For instance we can't get a reference to the editor of a created document.
    Kite = {
      request: sinon.stub().returns(Promise.resolve()),
      checkState: sinon.stub().returns(Promise.resolve()),
    }

    const uri = vscode.Uri.file(fixtureURI('sample.py'));

    return vscode.workspace.openTextDocument(uri)
    .then(doc => {
      editor = {
        document: doc,
        selection: {
          start: new vscode.Position(0,0),
          end: new vscode.Position(0,0),
        },
      }

      events = new EditorEvents(Kite, editor, true);
    });
  });

  it('only sends one event to kited', () => {
    return Promise.all([
      events.selectionChanged(),
      events.edit(),
    ])
    .then(() => {
      expect(Kite.request.callCount).to.eql(1);
      
      const [, json] = Kite.request.getCall(0).args;
      const payload = JSON.parse(json);
      expect(payload.action).to.eql('edit')
    });
  });
});
