"use strict";
const {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  MarkdownString,
  Range,
  SnippetString,
  window,
  workspace
} = require("vscode");
const { Logger } = require("kite-installer");
const { MAX_FILE_SIZE } = require("./constants");
const { parseJSON } = require("./utils");
const {
  completionsPath,
  normalizeDriveLetter,
  snippetsCompletionsPath
} = require("./urls");

const fill = (s, l, f = " ") => {
  while (s.length < l) {
    s = `${f}${s}`;
  }
  return s;
};

const kindForHint = hint => {
  switch (hint) {
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
  const wordRange = document.getWordRangeAtPosition(position);
  if (!wordRange) {
    return null;
  }
  return document.getText(wordRange);
};

// Transforms Kite snippet completion into a CompletionItem
const processSnippetCompletion = (document, c, numDigits, i, filterText) => {
  const item = new CompletionItem(c.display);
  item.insertText = c.snippet.text;
  // Use previous word, otherwise default to c.snippet.text.
  item.filterText = filterText ? filterText : c.snippet.text;
  item.sortText = fill(String(i), numDigits, "0");

  const start = document.positionAt(c.replace.begin);
  const end = document.positionAt(c.replace.end);
  item.range = new Range(start, end);
  if (c.documentation.text !== "") {
    item.documentation = buildMarkdown(c.web_id, c.hint, c.documentation.text);
  }
  // Note: The space following the Kite icon is the unicode space U+2003 instead
  // of the normal space U+0020 because VS Code strips the detail.
  item.detail = c.hint + " 𝕜𝕚𝕥𝕖 ";
  item.kind = kindForHint(c.hint);

  if (c.snippet.placeholders.length > 0) {
    item.kind = CompletionItemKind.Snippet;
    var offset = 0;
    let i = 0;
    for (i = 0; i < c.snippet.placeholders.length; i++) {
      let placeholder = c.snippet.placeholders[i];
      placeholder.begin += offset;
      placeholder.end += offset;
      item.insertText =
        item.insertText.slice(0, placeholder.begin) +
        "${" +
        (i + 1).toString() +
        ":" +
        item.insertText.slice(placeholder.begin, placeholder.end) +
        "}" +
        item.insertText.slice(placeholder.end);
      offset += 5;
    }
    // Add closing tab stop
    item.insertText += "$" + (i + 1).toString();
    item.insertText = new SnippetString(item.insertText);
  }
  return item;
};

module.exports = class KiteCompletionProvider {
  constructor(Kite, isTest) {
    this.Kite = Kite;
    this.isTest = isTest;
  }

  provideCompletionItems(document, position) {
    const text = document.getText();

    if (text.length > MAX_FILE_SIZE) {
      Logger.warn("buffer contents too large, not attempting completions");
      return Promise.resolve([]);
    }

    const filename = normalizeDriveLetter(document.fileName);
    const filterText = buildFilterText(document, position);
    // Use snippets completions.
    if (workspace.getConfiguration("kite").enableSnippets) {
      return this.getSnippetCompletions(document, text, filename, filterText);
    }
    // Use legacy completions.
    const cursorPosition = document.offsetAt(position);
    const payload = {
      text,
      editor: "vscode",
      filename,
      cursor_runes: cursorPosition,
      offset_encoding: "utf-16"
    };

    Logger.debug(payload);

    return this.Kite.request(
      {
        path: completionsPath(),
        method: "POST"
      },
      JSON.stringify(payload),
      document
    )
      .then(data => {
        data = parseJSON(data, {});
        const completions = data.completions || [];
        const length = String(completions.length).length;

        return completions.map((c, i) => {
          const item = new CompletionItem(c.display);
          item.sortText = fill(String(i), length, "0");
          item.insertText = c.insert;
          // Use previous word, otherwise default to c.insert.
          item.filterText = filterText ? filterText : c.insert;
          if (c.documentation_text !== "") {
            item.documentation = buildMarkdown(
              c.symbol.value[0].repr,
              c.hint,
              c.documentation_text
            );
          }
          // Note: The space following the Kite icon is the unicode space U+2003
          // instead of the normal space U+0020 because VS Code strips the detail.
          item.detail = c.hint + " ⟠ ";
          item.kind = kindForHint(c.hint);
          return item;
        });
      })
      .catch(() => []);
  }

  getSnippetCompletions(document, text, filename, filterText) {
    const selection = window.activeTextEditor.selection;
    const begin = document.offsetAt(selection.start);
    const end = document.offsetAt(selection.end);

    const payload = {
      text,
      editor: "vscode",
      filename,
      position: {
        begin,
        end
      },
      offset_encoding: "utf-16"
    };

    return this.Kite.request(
      {
        path: snippetsCompletionsPath(),
        method: "POST"
      },
      JSON.stringify(payload)
    )
      .then(data => {
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
            processSnippetCompletion(document, c, numDigits, idx, filterText)
          );
          const children = c.children || [];
          let offset = 1;
          children.forEach(child => {
            completionItems.push(
              processSnippetCompletion(
                document,
                child,
                numDigits,
                idx + offset,
                filterText
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
};
