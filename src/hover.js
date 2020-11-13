'use strict';

import { MarkdownString, Hover } from 'vscode';

import { hoverPath } from './urls';
import { compact, escapeCommandArguments } from './utils';
import { symbolName, symbolKindMarkdown } from './data-utils';

export default class KiteHoverProvider {
  constructor (Kite, isTest) {
    this.Kite = Kite;
    this.isTest = isTest;
  }

  provideHover(doc, position) {
    const path = hoverPath(doc, position);
    return this.Kite.request({ path })
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

          const content = new MarkdownString(`⟠&nbsp;&nbsp;__${symbolName(symbol).replace('_', '\\_')}__:&nbsp;${symbolKindMarkdown(symbol)}&nbsp;&nbsp;&nbsp;&nbsp;${docsLink}${defLink ? '&nbsp;&nbsp;' + defLink : ''}`);
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
