'use strict';


module.exports = class KiteEditor {
  constructor(Kite, editor) {
    this.Kite = Kite;
    this.editor = editor;
    this.document = editor.document;
    this.whitelisted = true;
  }

  isWhitelisted() {
    return this.whitelisted;
  }
}