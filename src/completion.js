'use strict';
const {CompletionItem, CompletionItemKind} = require('vscode');
const {Logger} = require('kite-installer');
const {MAX_FILE_SIZE} = require('./constants');
const {promisifyReadResponse, parseJSON} = require('./utils');
const {completionsPath, normalizeDriveLetter} = require('./urls');

const fill = (s, l, f = ' ') => {
  while(s.length < l) {
    s = `${f}${s}`
  }
  return s;
}

const kindForHint = hint => {
  switch(hint) {
    case 'function': return CompletionItemKind.Function;
    case 'module': return CompletionItemKind.Module;
    case 'type': return CompletionItemKind.Class;
    case 'keyword': return CompletionItemKind.Keyword;
    case 'string': return CompletionItemKind.Value;
    default: return CompletionItemKind.Value;
  }
}

module.exports = class KiteCompletionProvider {
  constructor(Kite) {
    this.Kite = Kite;
  }
  provideCompletionItems(document, position, token) {
    const text = document.getText();

    if (text.length > MAX_FILE_SIZE) {
      Logger.warn('buffer contents too large, not attempting completions');
      return Promise.resolve([]);
    }

    const cursorPosition = document.offsetAt(position);
    const payload = {
      text,
      editor: 'vscode',
      filename: normalizeDriveLetter(document.fileName),
      cursor_runes: cursorPosition,
    };
    Logger.debug(payload);

    return this.Kite.request({
      path: completionsPath(),
      method: 'POST',
    }, JSON.stringify(payload), document)
    .then(data => {
      data = parseJSON(data, {});
      const completions = data.completions || [];

      const length = String(completions.length).length;

      // this.lastCompletions = completions.reduce((m, c) => {

      // }, {});

      return completions.map((c, i) => {
        const item = new CompletionItem(c.display);
        item.sortText = fill(String(i), length, '0');
        item.insertText = c.insert;
        if (c.documentation_text !== '') {
          item.documentation = 'Kite: ' + c.documentation_text;
        }
        item.detail = c.hint;
        item.kind = kindForHint(c.hint);
        return item;
      });
    })
    .catch(err => []);
  }
}