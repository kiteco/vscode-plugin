'use strict';

import {
  Disposable,
  Hover,
  MarkdownString,
  Position,
  TextDocument,
  commands,
  window,
} from 'vscode';
import * as KiteAPI from "kite-api";

import NotificationsManager from "./notifications";

import { ICommandRegistrant } from './interfaces'
import metrics from "./metrics";
import { hoverPath } from './urls';
import {
  compact,
  escapeCommandArguments,
  kiteOpen,
  promisifiedKiteAPIRequest,
} from './utils';
import { symbolName, symbolKindMarkdown } from './data-utils';

enum Sources {
  Command = "Command",
  Hover = "Hover",
}

export class DocsCommands implements ICommandRegistrant {
  register(): Disposable[] {
    const ret = [];
    ret.push(commands.registerCommand("kite.docs-at-cursor", DocsCommands.docsAtCursor));
    ret.push(commands.registerCommand("kite.copilot-docs-from-position", DocsCommands.copilotDocsFromPos));
    return ret;
  }

  static async docsAtCursor() {
    const editor = window.activeTextEditor;
    if (editor) {
      const pos = editor.selection.active;
      const path = hoverPath(editor.document, pos);

      try {
        const resp = await KiteAPI.request({ path });
        if (resp.statusCode === 200) {
          commands.executeCommand("kite.copilot-docs-from-position", {
            position: pos,
            source: Sources.Command
          });
        }
      } catch(e) {
        NotificationsManager.notifyFromError(e);
      }
    }
  }

  static async copilotDocsFromPos(args: { position: Position, source: Sources }): Promise<void> {
    metrics.track(`${args.source} See info clicked`);
    const doc = window.activeTextEditor.document;
    const path = hoverPath(doc, args.position);
    try {
      const jdata = await promisifiedKiteAPIRequest({ path });
      const data = JSON.parse(jdata);
      kiteOpen(`kite://docs/${data.symbol[0].id}`);
    } catch(e) {
      NotificationsManager.notifyFromError(e);
    }
  }
}

export class KiteHoverProvider {
  async provideHover(doc: TextDocument, position: Position): Promise<Hover | void> {
    const path = hoverPath(doc, position);

    try {
      const jdata = await promisifiedKiteAPIRequest({ path });
      const data = JSON.parse(jdata);
      if (data && data.symbol && data.symbol.length) {
        const [symbol] = data.symbol;

        const docsLink = `[Docs](command:kite.copilot-docs-from-position?${escapeCommandArguments({
          position,
          source: Sources.Hover,
        })})`;

        let defLink: string;
        if (data && data.report && data.report.definition && data.report.definition.filename !== '') {
          const defData = escapeCommandArguments({
            file: data.report.definition.filename,
            line: data.report.definition.line,
            source: Sources.Hover,
          });
          defLink = `[Def](command:kite.def?${defData})`;
        }

        const content = new MarkdownString(`⟠&nbsp;&nbsp;__${symbolName(symbol).replace('_', '\\_')}__:&nbsp;${symbolKindMarkdown(symbol)}&nbsp;&nbsp;&nbsp;&nbsp;${docsLink}${defLink ? '&nbsp;&nbsp;' + defLink : ''}`);
        content.isTrusted = true;

        return new Hover(compact([content]));
      }
    } catch(err) {
      // Endpoint can 503 for paywall locked or 404 for not found symbol. Ignore those.
      const expected = err.data && (err.data.responseStatus === 503 || err.data.responseStatus === 404)
      if (!expected) {
        console.log(err, err.data)
      }
    }
  }
}
