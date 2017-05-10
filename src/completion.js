'use strict';
const {CompletionItem, CompletionItemKind} = require('vscode');
const {StateController, Logger} = require('kite-installer');
const {MAX_FILE_SIZE} = require('./constants');
const {promisifyRequest, promisifyReadResponse, parseJSON} = require('./utils');
const {completionsPath} = require('./urls');

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
      filename: document.fileName,
      cursor_runes: cursorPosition,
      localtoken: StateController.client.LOCAL_TOKEN,
    };
    Logger.debug(payload);

    return promisifyRequest(StateController.client.request({
      path: completionsPath(),
      method: 'POST',
    }, JSON.stringify(payload)))
    .then(resp => {
      this.Kite.handle403Response(document, resp);
      Logger.logResponse(resp);
    //   Kite.handle403Response(editor, resp);
      if (resp.statusCode === 404) {
        // This means we had no completions for this cursor position.
        // Do not call reject() because that will generate an error
        // in the console and lock autocomplete-plus
        return [];
      } else if (resp.statusCode !== 200) {
        return promisifyReadResponse(resp).then(data => {
          throw new Error(`Error ${resp.statusCode}: ${data}`);
        });
      } else {
        return promisifyReadResponse(resp);
      }
    })
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
        item.documentation = c.documentation_text;
        item.detail = c.hint;
        item.kind = kindForHint(c.hint);
        return item;
      });
    })
    .catch(err => {
      return [];
    });
  }
}