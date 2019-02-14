'use strict';

const KiteAPI = require('kite-api');
const {MAX_PAYLOAD_SIZE, MAX_FILE_SIZE} = require('./constants');
const {normalizeDriveLetter} = require('./urls');

module.exports = class EditorEvents {
  constructor(Kite, editor) {
    this.Kite = Kite;
    this.editor = editor;
    this.document = editor.document;
    this.reset();
  }

  dispose() {
    delete this.Kite;
    delete this.editor;
    delete this.document;
  }

  focus() {
    return this.send('focus');
  }

  edit() {
    return this.send('edit');
  }

  selectionChanged() {
    return this.send('selection');
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
    // was resulting in unhandled Promise rejection from `this.pendingPromiseReject(err)`
    // below... so we catch it
    return this.pendingPromise.catch((err) => {});
  }

  reset() {
    clearTimeout(this.timeout);
    this.pendingEvents = [];
  }

  mergeEvents() {
    if (!this.document || !this.editor) {
      return;
    }

    const doc = this.document;
    const editor= this.editor;
    let focus = this.pendingEvents.filter(e => e === 'focus')[0];
    let action = this.pendingEvents.some(e => e === 'edit') ? 'edit' : this.pendingEvents.pop();

    this.reset();

    const payload = JSON.stringify(this.buildEvent(action, doc, editor.selection));

    if (payload.length > MAX_PAYLOAD_SIZE) {
      return this.reset();
    }

    let promise = Promise.resolve();

    if (focus && action !== focus) {
      promise = promise.then(() => this.Kite.request({
        path: '/clientapi/editor/event',
        method: 'POST',
      }, JSON.stringify(this.buildEvent(focus, doc, editor.selection)), doc))
    }

    return promise
    .then(() => this.Kite.request({
      path: '/clientapi/editor/event',
      method: 'POST',
    }, payload, doc))
    .then((res) => {
      this.pendingPromiseResolve && this.pendingPromiseResolve(res);
    })
    .catch((err) => {
      this.pendingPromiseReject && this.pendingPromiseReject(err);
      // on connection error send a metric, but not too often or we will generate too many events
      // if (!this.lastErrorAt ||
      //     secondsSince(this.lastErrorAt) >= CONNECT_ERROR_LOCKOUT) {
      //   this.lastErrorAt = new Date();
      //   // metrics.track('could not connect to event endpoint', err);
      // }
    })
    .then(() => {
      delete this.pendingPromise;
      delete this.pendingPromiseResolve;
      delete this.pendingPromiseReject;
    });
  }

  buildEvent(action, document, selection) {
    const content = document.getText();
    return content.length > MAX_FILE_SIZE
      ? {
        source: 'vscode',
        action: 'skip',
        text: '',
        filename: normalizeDriveLetter(document.fileName),
        selections: [{start: 0, end: 0}]
      }
      : this.makeEvent(action, document, content, selection);
  }

  makeEvent(action, document, text, selection) {
    const event = {
      source: 'vscode',
      text,
      action,
      filename: normalizeDriveLetter(document.fileName),
    };

    if (selection && selection.start != null && selection.end != null) {
      event.selections = [{
        start: document.offsetAt(selection.start),
        end: document.offsetAt(selection.end),
      }]
    }

    return event;
  }
}
