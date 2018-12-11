'use strict';
const {CompletionItem, CompletionItemKind, MarkdownString} = require('vscode');
const {Logger} = require('kite-installer');
const {MAX_FILE_SIZE} = require('./constants');
const {parseJSON} = require('./utils');
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
  constructor(Kite, isTest) {
    this.Kite = Kite;
    this.isTest = isTest;
  }

  provideCompletionItems(document, position, token) {
    // hueristic - based on how editors are registered for whitelisting based on
    // documents, it should be sufficient to see if just one passes the check below
    if (this.isTest || this.Kite.isDocumentWhitelisted(document)) {
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
      console.log('sending completions payload', payload);


      // const event = {
      //   source: 'vscode',
      //   text: document.getText(),
      //   action: 'edit',
      //   filename: normalizeDriveLetter(document.fileName),
      //   selections: [{start: cursorPosition, end: cursorPosition}]
      // };

      // let promise = Promise.resolve().then(() => this.Kite.request({
      //   path: '/clientapi/editor/event',
      //   method: 'POST',
      // }, JSON.stringify(event), document));

      let promise = Promise.resolve();

      return promise.then(() => this.Kite.request({
        path: completionsPath(),
        method: 'POST',
      }, JSON.stringify(payload), document))
      .then(data => {
        data = parseJSON(data, {});

        // console.log('received completions data', data);

        const completions = data.completions || [];

        const length = String(completions.length).length;

        // console.log(`got ${ completions.length } completions: ${ completions.map(c => c.display).join(', ') }`);

        return completions.map((c, i) => {
          const item = new CompletionItem('⟠ ' + c.display);
          item.sortText = fill(String(i), length, '0');
          item.insertText = c.insert;
          if (c.documentation_text !== '') {
            item.documentation = new MarkdownString(`[𝕜𝕚𝕥𝕖]&nbsp;&nbsp;__${c.symbol.value[0].repr}__&nbsp;&nbsp;&nbsp;&nbsp;_${c.hint}_

  ${c.documentation_text}

            `);
          }
          item.kind = kindForHint(c.hint);
          return item;
        });
      })
      .catch(err => []);
    } else {
      return Promise.resolve([]);
    }
  }
}