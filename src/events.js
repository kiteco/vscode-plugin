'use strict';

const {MAX_FILE_SIZE, CONNECT_ERROR_LOCKOUT} = require('./constants');
const {secondsSince} = require('./utils');
const {normalizeDriveLetter} = require('./urls');
 
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
    return this.sendEvent('edit');
  }

  selectionChanged() {
    return this.Kite.checkState().then(() => this.sendEvent('selection'));
  }

  sendEvent(action) {
    const content = this.document.getText();
    const event = content.length > MAX_FILE_SIZE
      ? {
        source: 'vscode',
        action: 'skip',
        filename: normalizeDriveLetter(this.document.fileName),
      }
      : this.makeEvent(action, this.document, content, this.editor.selection);
    
    const payload = JSON.stringify(event);

    return this.Kite.request({
      path: '/clientapi/editor/event',
      method: 'POST',
    }, payload, this.document)
    .catch(() => {
      // on connection error send a metric, but not too often or we will generate too many events
      if (!this.lastErrorAt ||
          secondsSince(this.lastErrorAt) >= CONNECT_ERROR_LOCKOUT) {
        this.lastErrorAt = new Date();
        // metrics.track('could not connect to event endpoint', err);
      }
    });
  }

  makeEvent(action, document, text, selection) {
    const event = {
      source: 'vscode',
      text,
      action,
      filename: normalizeDriveLetter(document.fileName),
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