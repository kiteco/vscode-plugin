'use strict';

const EditorEvents = require('./events');
module.exports = class KiteEditor {
  constructor(Kite, editor) {
    this.Kite = Kite;
    this.editor = editor;
    this.document = editor.document;
    this.events = new EditorEvents(Kite, editor);
    this.enabled = true;
    this.whitelisted = true;
  }

  focus() {
    this.enabled && this.events.focus();
  }

  edit() {
    this.enabled && this.events.edit();
  }

  selectionChanged() {
    this.enabled && this.events.selectionChanged();
  }

  isWhitelisted() {
    return this.whitelisted;
  }
}