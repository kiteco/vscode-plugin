'use strict';

const {MAX_PAYLOAD_SIZE, MAX_FILE_SIZE, CONNECT_ERROR_LOCKOUT} = require('./constants');
const {secondsSince} = require('./utils');
const {normalizeDriveLetter} = require('./urls');
 
module.exports = class EditorEvents {
  constructor(Kite, editor, isTest) {
    this.Kite = Kite;
    this.editor = editor;
    this.document = editor.document;
    this.isTest = isTest;
    this.reset();
  }

  focus() {
    return this.isTest || this.Kite.isEditorWhitelisted(this.editor) ?
      this.Kite.checkState('focus').then(() => this.send('focus')) :
      Promise.resolve();
  }

  edit() {
    return this.isTest || this.Kite.isEditorWhitelisted(this.editor) ?
      this.send('edit') :
      Promise.resolve();
  }

  selectionChanged() {
    return this.isTest || this.Kite.isEditorWhitelisted(this.editor) ? 
      this.Kite.checkState('selectionChanged').then(() => this.send('selection')) :
      Promise.resolve();
  }

  send(action) {
    if (!this.pendingPromise) {
      this.pendingPromise = new Promise((resolve, reject) => {
        this.pendingPromiseResolve = resolve;
        this.pendingPromiseReject = reject;
      });
    }
    this.pendingEvents.push(action);
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.mergeEvents(), 0);

    return this.pendingPromise;
  }

  reset() {
    clearTimeout(this.timeout);
    this.pendingEvents = [];
  }

  mergeEvents() {
    let action = this.pendingEvents.some(e => e === 'edit') ? 'edit' : this.pendingEvents.pop();

    this.reset();

    const payload = JSON.stringify(this.buildEvent(action));

    if (payload.length > MAX_PAYLOAD_SIZE) {
      return this.reset();
    }

    return this.Kite.request({
      path: '/clientapi/editor/event',
      method: 'POST',
    }, payload, this.document)
    .then((res) => {
      this.pendingPromiseResolve(res);
    })
    .catch((err) => {
      this.pendingPromiseReject(err);
      // on connection error send a metric, but not too often or we will generate too many events
      if (!this.lastErrorAt ||
          secondsSince(this.lastErrorAt) >= CONNECT_ERROR_LOCKOUT) {
        this.lastErrorAt = new Date();
        // metrics.track('could not connect to event endpoint', err);
      }
    })
    .then(() => {
      delete this.pendingPromise;
      delete this.pendingPromiseResolve;
      delete this.pendingPromiseReject;
    });
  }

  buildEvent(action) {
    const content = this.document.getText();
    return content.length > MAX_FILE_SIZE
      ? {
        source: 'vscode',
        action: 'skip',
        filename: normalizeDriveLetter(this.document.fileName),
      }
      : this.makeEvent(action, this.document, content, this.editor.selection);
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