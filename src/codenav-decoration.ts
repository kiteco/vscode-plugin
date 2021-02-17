import * as path from 'path';
import * as process from 'process';
import {
  DecorationOptions,
  DecorationRangeBehavior,
  Event,
  extensions,
  MarkdownString,
  Position,
  Range,
  TextEditor,
  TextEditorDecorationType,
  TextEditorSelectionChangeEvent,
  TextEditorSelectionChangeKind,
  ThemeColor,
  window,
  workspace
} from 'vscode';

import * as KiteAPI from "kite-api";

export const relatedCodeLineDecoration: TextEditorDecorationType = window.createTextEditorDecorationType({
  rangeBehavior: DecorationRangeBehavior.ClosedOpen,
});

interface decorationStatusResponse {
  inlineMessage: string,
  hoverMessage: string,
  projectReady: boolean,
}

interface IOnDidChangeTextEditorSelection {
  onDidChangeTextEditorSelection: Event<TextEditorSelectionChangeEvent>
}

export default class KiteRelatedCodeDecorationsProvider {
  private lineInfo: decorationStatusResponse | undefined
  private activeEditor: TextEditor | undefined
  private editTimeout: ReturnType<typeof setTimeout> | undefined

  constructor(win: IOnDidChangeTextEditorSelection = window) {
    this.lineInfo = undefined;
    this.activeEditor = undefined;
    this.editTimeout = undefined;
    win.onDidChangeTextEditorSelection(this.onDidChangeTextEditorSelection.bind(this));
  }

  public dispose(): void {
    // Clears all decorations of this type
    relatedCodeLineDecoration.dispose();
  }

  // For testing and easy stubbing
  public enabled(): boolean {
    return workspace.getConfiguration('kite').codefinder.enableLineDecoration;
  }

  // Public for testing
  public async onDidChangeTextEditorSelection(event: TextEditorSelectionChangeEvent): Promise<void> {
    if (!this.enabled()) {
      this.clearDecorations(event.textEditor)
      return;
    }

    if (typeof(this.editTimeout) === 'undefined' && (event.kind === TextEditorSelectionChangeKind.Command || event.kind === TextEditorSelectionChangeKind.Mouse)) {
      // If timeout is not set (i.e. the decoration is already showing), and the cursor is moved by
      // a non-edit event, then show the decoration immediately.
      await this.decorate(event);

    } else {
      // Otherwise, show the decoration after 1 second of inactivity.
      this.clearDecorations(event.textEditor);

      if (typeof(this.editTimeout) !== 'undefined') {
        clearTimeout(this.editTimeout);
        this.editTimeout = undefined;
      }

      this.editTimeout = setTimeout(() => {
        this.decorate(event);
      }, 1000);
    }
  }

  private async decorate(event: TextEditorSelectionChangeEvent): Promise<void> {
    const editor = event.textEditor;
    const applicable = this.lineInfo && this.lineInfo.projectReady !== undefined;
    const ready = this.lineInfo && this.lineInfo.projectReady;
    if (!this.lineInfo || editor !== this.activeEditor || (applicable && !ready)) {
      await this.reset(editor);
    } else if (event.selections.length != 1) {
      await this.reset(editor);
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
            margin: '0 0 0 4em',
            color: new ThemeColor('textSeparator.foreground'),
            fontWeight: 'normal',
            fontStyle: 'normal',
          }
        }
      };
      editor.setDecorations(relatedCodeLineDecoration, [opts]);
    }

    this.editTimeout = undefined;
  }

  private hoverMessage(hover: string): MarkdownString {
    let logo = path.join(extensions.getExtension("kiteco.kite").extensionPath, "dist", "assets", "images", "logo-light-blue.svg");
    if (process.platform === 'win32') {
      logo = `file:\\\\${logo}`;
      // Replace all \ in Windows path with \\
      // otherwise c:\Users\Foo\.vscode turns into c:\Users\Foo.vscode
      logo = logo.replace(/\\/g,'\\\\');
    }
    const md = new MarkdownString(`![KiteIcon](${logo}|height=12)&nbsp;&nbsp;[${hover}](command:kite.related-code-from-line)`);
    // Must mark as trusted to run commands in MarkdownStrings
    md.isTrusted = true;
    return md;
  }

  private lineEnd(pos: Position): Range {
    const ending = pos.with(pos.line, 9999);
    return new Range(ending, ending);
  }

  private async reset(editor: TextEditor): Promise<void> {
    this.clearDecorations(editor);
    const info = await this.fetchDecoration(editor.document.fileName);
    if (!info) {
      return;
    }
    this.lineInfo = info;
  }

  private clearDecorations(editor: TextEditor) {
    editor.setDecorations(relatedCodeLineDecoration, []);
    this.activeEditor = editor;
    this.lineInfo = undefined;
  }

  private async fetchDecoration(filename: string): Promise<decorationStatusResponse | null> {
    try {
      const resp = await KiteAPI.getLineDecoration(filename);
      if (resp && !resp.err) {
        return {
          inlineMessage: resp.inline_message,
          hoverMessage: resp.hover_message,
          projectReady: resp.project_ready,
        } as decorationStatusResponse;
      }
    } catch (e) {
      // pass
    }
    return null;
  }
}
