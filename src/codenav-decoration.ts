import * as path from 'path';
import {
  DecorationOptions,
  DecorationRangeBehavior,
  extensions,
  MarkdownString,
  Position,
  Range,
  TextEditor,
  TextEditorDecorationType,
  TextEditorSelectionChangeEvent,
  window,
  workspace
} from 'vscode';

import * as KiteAPI from "kite-api";
import { codenavDecorationLinePath } from './urls';

const relatedCodeLineDecoration: TextEditorDecorationType = window.createTextEditorDecorationType({
  rangeBehavior: DecorationRangeBehavior.ClosedOpen,
});

interface decorationStatusResponse {
  inlineMessage: string,
  hoverMessage: string,
  projectReady: boolean,
}

export default class KiteRelatedCodeDecorationsProvider {
  private lineInfo: decorationStatusResponse | undefined
  private activeEditor: TextEditor | undefined

  constructor() {
    this.lineInfo = undefined;
    this.activeEditor = undefined;
    window.onDidChangeTextEditorSelection(this.onDidChangeTextEditorSelection.bind(this));
  }

  public dispose(): void {
    // Clears all decorations of this type
    relatedCodeLineDecoration.dispose();
  }

  private async onDidChangeTextEditorSelection(event: TextEditorSelectionChangeEvent): Promise<void> {
    if (!workspace.getConfiguration('kite').codefinder.enableLineDecoration) {
      return;
    }

    const editor = event.textEditor;
    const applicable = this.lineInfo && this.lineInfo.projectReady !== undefined;
    const ready = this.lineInfo && this.lineInfo.projectReady;
    if (editor !== this.activeEditor || (applicable && !ready)) {
      await this.reset(editor);
    }
    if (event.selections.length != 1) {
      return;
    }

    if (this.lineInfo && this.lineInfo.projectReady) {
      const cursor: Position = event.selections[0].active;
      const opts: DecorationOptions = {
        hoverMessage: this.hoverMessage(this.lineInfo.hoverMessage),
        range: this.lineEnd(cursor),
        renderOptions: {
          after: {
            contentText: `${this.lineInfo.inlineMessage}`,
            margin: '0 0 0 3em',
            color: '#4784d6',
            fontWeight: 'normal',
            fontStyle: 'normal',
          }
        }
      };
      editor.setDecorations(relatedCodeLineDecoration, [opts]);
    }
  }

  private hoverMessage(hover: string): MarkdownString {
    const logo = path.join(extensions.getExtension("kiteco.kite").extensionPath , "/dist/assets/images/logo-white.svg");
    const md = new MarkdownString(`![KiteIcon](${logo}|height=10,backgroundColor=#4784d6) [${hover}](command:kite.related-code-from-line)`);
    // Must mark as trusted to run commands in MarkdownStrings
    md.isTrusted = true;
    return md;
  }

  private lineEnd(pos: Position): Range {
    const ending = pos.with(pos.line, 9999);
    return new Range(ending, ending);
  }

  private async reset(editor: TextEditor): Promise<void> {
    editor.setDecorations(relatedCodeLineDecoration, []);
    this.activeEditor = editor;
    this.lineInfo = undefined;
    const info = await this.fetchLineDecorationInfo(editor.document.fileName);
    if (!info) {
      return;
    }
    this.lineInfo = info;
  }

  private async fetchLineDecorationInfo(filename: string): Promise<decorationStatusResponse | null> {
    // TODO: Pull call into kite-api
    try {
      const resp = await KiteAPI.requestJSON(
        {
          path: codenavDecorationLinePath(),
          method: 'POST'
        },
        JSON.stringify({ filename }),
      );
      if (resp && !resp.err) {
        return {
          inlineMessage: resp.inline_message,
          hoverMessage: resp.hover_message,
          projectReady: resp.project_ready,
        } as decorationStatusResponse;
      }
    } catch (e) {
      console.log(e, e.data);
    }
    return null;
  }
}
