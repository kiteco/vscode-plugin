'use strict';

const {StateController, Logger} = require('kite-installer');
const {MAX_PAYLOAD_SIZE, CONNECT_ERROR_LOCKOUT} = require('./constants');
const {promisifyRequest, secondsSince, normalizeDriveLetter} = require('./utils');

module.exports = class EditorEvents {
  constructor(Kite, editor) {
    this.Kite = Kite;
    this.editor = editor;
    this.document = editor.document;
  }

  focus() {
    return this.Kite.checkState().then(() => this.sendEvent('focus'));
  }

  edit() {
    return this.Kite.checkState().then(() => this.sendEvent('edit'));
  }

  selectionChanged() {
    return this.Kite.checkState().then(() => this.sendEvent('selection'));
  }

  sendEvent(action) {
    const event = this.makeEvent(action, this.document, this.editor.selection);
    const payload = JSON.stringify(event);

    if (payload.length > MAX_PAYLOAD_SIZE) {
      Logger.warn('unable to send message because length exceeded limit');
      return;
    }

    return promisifyRequest(StateController.client.request({
      path: '/clientapi/editor/event',
      method: 'POST',
    }, payload))
    .then(resp => {
      if (this.Kite.isGrammarSupported(this.editor)) {
        this.Kite.handle403Response(this.document, resp);
      } 
      Logger.logResponse(resp);
    })
    .catch(() => {
      // on connection error send a metric, but not too often or we will generate too many events
      if (!this.lastErrorAt ||
          secondsSince(this.lastErrorAt) >= CONNECT_ERROR_LOCKOUT) {
        this.lastErrorAt = new Date();
        // metrics.track('could not connect to event endpoint', err);
      }
    });
  }

  makeEvent(action, document, selection) {
    const event = {
      source: 'vscode',
      action,
      filename: normalizeDriveLetter(document.fileName),
      text: document.getText(),
    };

    if (selection) {
      event.selections = [{
        start: document.offsetAt(selection.start),
        end: document.offsetAt(selection.end),
      }]
    }

    return event;
  }
}