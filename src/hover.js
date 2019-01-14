'use strict';

const vscode = require('vscode');
const {Hover} = vscode;
const {hoverPath} = require('./urls');
const {compact, escapeCommandArguments} = require('./utils');
const {symbolName, symbolKind} = require('./data-utils');

module.exports = class KiteHoverProvider {
  constructor (Kite, isTest) {
    this.Kite = Kite;
    this.isTest = isTest;
  }

  provideHover(doc, position) {
    const path = hoverPath(doc, position);
    return this.Kite.request({path})
    .then(data => JSON.parse(data))
    .then(data => {
      if (data && data.symbol && data.symbol.length) {
        const [symbol] = data.symbol;

        const docsLink = `[Docs](command:kite.more-position?${escapeCommandArguments({
          position,
          source: 'Hover',
        })})`;

        let defLink;
        if (data && data.report && data.report.definition && data.report.definition.filename !== '') {
          const defData = escapeCommandArguments({
            file: data.report.definition.filename,
            line: data.report.definition.line,
            source: 'Hover',
          });
          defLink = `[Def](command:kite.def?${defData})`;
        }

        const content = new vscode.MarkdownString(`[𝕜𝕚𝕥𝕖]&nbsp;&nbsp;__${symbolName(symbol)}__&nbsp;&nbsp;${docsLink}${defLink ? '&nbsp;&nbsp;' + defLink : ''}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_${symbolKind(symbol)}_`);
        content.isTrusted = true;

        const texts = [
          content
        ];

        return new Hover(compact(texts));
      }
    })
    .catch(() => {});
  }
}
