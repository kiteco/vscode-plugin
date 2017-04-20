'use strict';

const {StateController, Logger} = require('kite-installer');
const {MAX_PAYLOAD_SIZE} = require('./constants');
const {promisifyRequest} = require('./utils');

module.exports = class EditorEvents {
  constructor(editor) {
    this.editor = editor;
    this.document = editor.document;
  }

  focus() {
    this.sendEvent('focus');
  }

  edit() {
    this.sendEvent('edit');
  }

  selectionChanged() {
    this.sendEvent('selection');
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
      Logger.logResponse(resp);
    })
    .catch(err => {
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
      filename: document.fileName,
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