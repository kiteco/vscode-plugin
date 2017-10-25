'use strict';

const TokensList = require('./tokens-list');

module.exports = class KiteEditor {
  constructor(Kite, editor) {
    this.Kite = Kite;
    this.editor = editor;
    this.document = editor.document;
    this.whitelisted = true;
    this.tokensList = new TokensList(this.editor);

    this.tokensList.updateTokens()
  }

  isWhitelisted() {
    return this.whitelisted;
  }
}