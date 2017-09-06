'use strict';

const vscode = require('vscode');
const {Hover} = vscode;
const {hoverPath} = require('./urls');
const {compact} = require('./utils');
const {symbolName, symbolKind, symbolId, idIsEmpty} = require('./data-utils');

module.exports = class KiteHoverProvider {
  constructor (Kite) {
    this.Kite = Kite;
  }

  provideHover(doc, pos) {
    const range = doc.getWordRangeAtPosition(pos);
    const path = hoverPath(doc, range);
    return this.Kite.request({path})
    .then(data => JSON.parse(data))
    .then(data => {
      if (data && data.symbol && data.symbol.length) {
        const [symbol] = data.symbol;
        const id = symbolId(symbol);
        const texts = [{
            language: 'python', 
            value: `${symbolName(symbol)}    ${symbolKind(symbol)}`
          },
        ];

        const links = [];

        if (!idIsEmpty(id)) {
          links.push(`[web](command:kite.web?${JSON.stringify({
            id,
            source: 'Hover',
          })})`);
          links.push(`[more](command:kite.more-range?${JSON.stringify({
            range,
            source: 'Hover',
          })})`);
        } else {
          links.push(`[more](command:kite.more-range?${JSON.stringify({
            range,
            source: 'Hover',
          })})`);
        }
        
        if (data && data.report && data.report.definition && data.report.definition.filename !== '') {
          const defData = JSON.stringify({
            file: data.report.definition.filename,
            line: data.report.definition.line,
            source: 'Hover',
          });
          links.push(`[def](command:kite.def?${defData})`);
        }

        if (links.length) { texts.push('**Kite:** ' + links.join(' ')); }

        return new Hover(compact(texts));
      }
    })
    .catch(err => null);
  }
}