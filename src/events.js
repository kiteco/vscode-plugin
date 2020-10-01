'use strict';

const { version: editor_version } = require('vscode');

const { version: plugin_version } = require('./metrics');
const { normalizeDriveLetter } = require('./urls');

module.exports = class EditorEvents {
  constructor(Kite, editor) {
    this.Kite = Kite;
    this.editor = editor;
    this.reset();
  }

  dispose() {
    delete this.Kite;
    delete this.editor;
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
    return this.pendingPromise.catch(() => { });
  }

  reset() {
    clearTimeout(this.timeout);
    this.pendingEvents = [];
  }

  mergeEvents() {
    if (!this.editor || !this.editor.document) {
      return;
    }

    const editor = this.editor;
    const doc = editor.document;
    const focus = this.pendingEvents.filter(e => e === 'focus')[0];
    const action = this.pendingEvents.some(e => e === 'edit') ? 'edit' : this.pendingEvents.pop();

    this.reset();

    const payload = JSON.stringify(this.buildEvent(action, doc, editor.selection));

    let promise = Promise.resolve();

    if (focus && action !== focus) {
      promise = promise.then(() => this.Kite.request({
        path: '/clientapi/editor/event',
        method: 'POST',
      }, JSON.stringify(this.buildEvent(focus, doc, editor.selection)), doc));
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
      })
      .finally(() => {
        delete this.pendingPromise;
        delete this.pendingPromiseResolve;
        delete this.pendingPromiseReject;
      });
  }

  buildEvent(action, document, selection) {
    const content = document.getText();
    return content.length > this.Kite.maxFileSize
      ? {
        source: 'vscode',
        action: 'skip',
        text: '',
        filename: normalizeDriveLetter(document.fileName),
        selections: [{ start: 0, end: 0, encoding: 'utf-16' }],
        editor_version,
        plugin_version
      }
      : this.makeEvent(action, document, content, selection);
  }

  makeEvent(action, document, text, selection) {
    const event = {
      source: 'vscode',
      text,
      action,
      filename: normalizeDriveLetter(document.fileName),
      editor_version,
      plugin_version
    };

    if (selection && selection.start != null && selection.end != null) {
      event.selections = [{
        start: document.offsetAt(selection.start),
        end: document.offsetAt(selection.end),
        encoding: 'utf-16',
      }];
    }

    return event;
  }
};
