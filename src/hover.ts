'use strict';

import {
  Hover,
  MarkdownString,
  Position,
  TextDocument,
} from 'vscode';

import { hoverPath } from './urls';
import { compact, escapeCommandArguments } from './utils';
import { symbolName, symbolKindMarkdown } from './data-utils';

interface IRequest {
  request(o: { path: string }): Promise<string>
}

export default class KiteHoverProvider {
  private Kite: IRequest

  constructor (Kite: IRequest) {
    this.Kite = Kite;
  }

  async provideHover(doc: TextDocument, position: Position): Promise<Hover | void> {
    const path = hoverPath(doc, position);

    try {
      const jdata = await this.Kite.request({ path });
      const data = JSON.parse(jdata);
      if (data && data.symbol && data.symbol.length) {
        const [symbol] = data.symbol;

        const docsLink = `[Docs](command:kite.copilot-docs-from-position?${escapeCommandArguments({
          position,
          source: 'Hover',
        })})`;

        let defLink: string;
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

        return new Hover(compact([content]));
      }
    } catch {
      // pass
    }
  }
}
