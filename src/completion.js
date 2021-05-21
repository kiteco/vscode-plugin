"use strict";
import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  MarkdownString,
  Range,
  SnippetString,
  window,
  workspace
} from 'vscode';
import Logger from "kite-connector/lib/logger";
import {
  KITE_BRANDING,
  OFFSET_ENCODING
} from "./constants";
import {
  parseJSON,
  getSupportedLanguage
} from "./utils";
import {
  completionsPath,
  normalizeDriveLetter
} from "./urls";


const fill = (s, l, f = " ") => {
  while (s.length < l) {
    s = `${f}${s}`;
  }
  return s;
};

const kindForHint = hint => {
  switch (hint) {
    case "call":
    case "function":
      return CompletionItemKind.Function;
    case "module":
      return CompletionItemKind.Module;
    case "type":
      return CompletionItemKind.Class;
    case "keyword":
      return CompletionItemKind.Keyword;
    case "string":
      return CompletionItemKind.Value;
    default:
      return CompletionItemKind.Value;
  }
};

const buildMarkdown = (id, hint, documentation_text) => {
  return new MarkdownString(`[𝕜𝕚𝕥𝕖]&nbsp;&nbsp;__${id}__&nbsp;&nbsp;&nbsp;&nbsp;_${hint}_

${documentation_text}

            `);
};

const buildFilterText = (document, position) => {
  const selection =
    window.activeTextEditor && window.activeTextEditor.selection;
  const wordRange =
    document.getWordRangeAtPosition(position) ||
    (selection && new Range(selection.start, selection.end)); // Snippet placeholder selection range
  if (!wordRange) {
    return null;
  }
  return document.getText(wordRange);
};

// Transforms Kite completion into a CompletionItem
const processCompletion = (
  document,
  c,
  displayPrefix,
  numDigits,
  i
) => {
  const item = new CompletionItem(displayPrefix + c.display);

  const start = document.positionAt(c.replace.begin);
  const end = document.positionAt(c.replace.end);
  const replaceRange = new Range(start, end);
  item.filterText = document.getText(replaceRange);
  item.keepWhitespace = true;

  if (i === 0) {
    item.preselect = true;
  }
  item.sortText = fill(String(i), numDigits, "\0");
  item.range = replaceRange;
  if (c.documentation.text !== "") {
    item.documentation = buildMarkdown(c.web_id, c.hint, c.documentation.text);
  }
  // Note: The space following the Kite icon is the unicode space U+2003 instead
  // of the normal space U+0020 because VS Code strips the detail.
  item.detail = c.hint + KITE_BRANDING;
  item.kind = kindForHint(c.hint);

  item.insertText = c.snippet.text;
  const placeholders = c.snippet.placeholders;
  if (Array.isArray(placeholders) && placeholders.length) {
    let snippetText = c.snippet.text;
    var offset = 0;
    let i = 0;
    for (i = 0; i < c.snippet.placeholders.length; i++) {
      let placeholder = c.snippet.placeholders[i];
      placeholder.begin += offset;
      placeholder.end += offset;
      snippetText =
      snippetText.slice(0, placeholder.begin) +
        "${" +
        (i + 1).toString() +
        ":" +
        snippetText.slice(placeholder.begin, placeholder.end) +
        "}" +
        snippetText.slice(placeholder.end);
      offset += 5;
    }
    // Sanitize snippet text by replacing all $ not for placeholders with \\$
    snippetText = snippetText.replaceAll(/\$(?!{)/g, "\\$");
    // Add closing tab stop
    snippetText += "$0";
    item.insertText = new SnippetString(snippetText);
  }

  item.command = {
    command: "kite.insert-completion",
    arguments: [{ lang: getSupportedLanguage(document), completion: { snippet: { text: c.snippet.text }}}]
  };

  return item;
};

export default class KiteCompletionProvider {
  constructor(Kite, triggers, optionalTriggers, win = window) {
    this.Kite = Kite;
    this.triggers = triggers;
    this.optionalTriggers = optionalTriggers || [];
    this.window = win;
  }

  provideCompletionItems(document, position, token, context) {
    const text = document.getText();

    if (text.length > this.Kite.maxFileSize) {
      Logger.warn("buffer contents too large, not attempting completions");
      return Promise.resolve([]);
    }

    const filename = normalizeDriveLetter(document.fileName);
    const filterText = buildFilterText(document, position);
    return this.getCompletions(document, text, filename, filterText, context);
  }

  getCompletions(document, text, filename, filterText, context) {
    const selection = this.window.activeTextEditor.selection;
    const begin = document.offsetAt(selection.start);
    const end = document.offsetAt(selection.end);
    const enableSnippets = workspace.getConfiguration("kite").enableSnippets;

    const isOptionalTrigger = this.optionalTriggers.indexOf(context.triggerCharacter) !== -1;
    const shouldShowOptionalTrigger = workspace.getConfiguration('kite').enableOptionalCompletionsTriggers;

    const payload = {
      text,
      editor: "vscode",
      filename,
      position: {
        begin,
        end
      },
      no_snippets: !enableSnippets,
      offset_encoding: OFFSET_ENCODING,
    };

    return this.Kite.request(
      {
        path: completionsPath(),
        method: "POST"
      },
      JSON.stringify(payload)
    )
      .then(data => {
        if (isOptionalTrigger && !shouldShowOptionalTrigger) {
          // Don't return anything because if we're wrong, it'll block all other
          // VS Code completions that come after the space.
          return [];
        }

        data = parseJSON(data, {});
        const completions = data.completions || [];
        // # of completion items + its children
        const totalCompletions = completions.reduce((total, completion) => {
          let toReturn = total + 1;
          if (completion.children) {
            toReturn += completion.children.length;
          }
          return toReturn;
        }, 0);
        // # of digits needed to represent totalCompletions. Used for sortText.
        const numDigits = String(totalCompletions).length;
        const completionItems = [];
        // Used to track order in suggestion list
        let idx = 0;
        completions.forEach(c => {
          completionItems.push(
            processCompletion(
              document,
              c,
              "",
              numDigits,
              idx
            )
          );
          const children = c.children || [];
          let offset = 1;
          children.forEach(child => {
            completionItems.push(
              processCompletion(
                document,
                child,
                "  ",
                numDigits,
                idx + offset
              )
            );
            offset += 1;
          });
          idx += offset;
        });
        return new CompletionList(completionItems, true);
      })
      .catch(() => []);
  }
}
