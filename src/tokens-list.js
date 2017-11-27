'use strict';

const vscode = require('vscode');
const {StateController} = require('kite-installer');
const {head, screenPositionForMouseEvent, screenPositionForPixelPosition, promisifyReadResponse} = require('./utils');
const {tokensPath} = require('./urls');

class TokensList {
  constructor(editor, tokens = []) {
    this.editor = editor;
    this.document = editor.document;
    this.setTokens(tokens);
  }

  dispose() {
    delete this.editor;
    delete this.document;
    delete this.tokens;
  }

  setTokens(tokens) {
    this.tokens = tokens;
  }

  clearTokens() {
    this.tokens = [];
  }

  updateTokens() {
    return this.editor
      ? this.getTokensForEditor(this.editor).then(tokens => {
        this.setTokens(tokens.tokens);
      }).catch(() => {})
      : Promise.reject('Editor was destroyed');
  }

  getTokensForEditor(editor) {
    const path = tokensPath(editor.document);
    return StateController.client.request({path})
    .then(resp => {
      if (resp.statusCode !== 200) {
        throw new Error(`${resp.statusCode} status at ${path}`);
      }
      return promisifyReadResponse(resp);
    })
    .then(data => JSON.parse(data));
  }

  tokenAtPosition(position) {
    const pos = this.document.offsetAt(position);
    return this.tokens
      ? head(this.tokens.filter(token => pos >= token.begin_bytes &&
                                         pos <= token.end_bytes))
      : null;
  }

  tokenRange(token) {
    this.document.positionAt(token.begin_bytes),
    this.document.positionAt(token.end_bytes)
    return new vscode.Range();
  }

  tokenAtRange(range) {
    let {start, end} = range;
    start = this.document.offsetAt(start);
    end = this.document.offsetAt(end);
    return this.tokens
      ? head(this.tokens.filter(token => token.begin_bytes === start &&
                                         token.end_bytes === end))
      : null;
  }
}

module.exports = TokensList;
