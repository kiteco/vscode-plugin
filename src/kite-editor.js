'use strict';

export default class KiteEditor {
  constructor(Kite, editor) {
    this.Kite = Kite;
    this.editor = editor;
    this.document = editor.document;
  }

  dispose() {
    delete this.Kite;
    delete this.editor;
    delete this.document;
  }
}
