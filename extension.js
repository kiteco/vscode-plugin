'use strict';

// Contents of this plugin will be reset by Kite on start. Changes you make
// are not guaranteed to persist.

const vscode = require('vscode');
var http = require('http')

var PLUGIN_ID = null;
const SOURCE = "vscode";

// MAX_TEXT_SIZE is a limit on the number of bytes in the text buffer.
// Above this limit, events will not contain the contents of the buffer.
const MAX_TEXT_SIZE = Math.pow(2, 20);

// MAX_PAYLOAD_SIZE is a limit on the number of bytes in the body of each HTTP
// request, after encoding the full JSON object. Given the MAX_TEXT_SIZE
// limit, this limit should never be exceeded, but we still have it just in
// case.
const MAX_PAYLOAD_SIZE = Math.pow(2, 21);

// Called when VSCode is started
function activate (context) {
  console.log("kite activating");
  let eventController = new KiteEventController();
  context.subscriptions.push(eventController);
}

// Called when VSCode is shut down.
function deactivate () {
}

// Listens for events from the editor and provides them to Kite.
var KiteEventController = class {
  constructor() {
    let subscriptions = [];

    vscode.window.onDidChangeTextEditorSelection(this.onSelection, this, subscriptions);
    vscode.workspace.onDidChangeTextDocument(this.onEdit, this, subscriptions);
    vscode.window.onDidChangeActiveTextEditor(this.onEditorChange, this, subscriptions);

    this._disposable = vscode.Disposable.from(subscriptions);
  }

  dispose () {
    this._disposable.dispose();
  }

  // Builds a kite event based on action. An action being
  // an edit, a selection, or a focus.
  buildKiteEvent (action) {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      return null;
    }

    let text = editor.document.getText();

    if (text.length > MAX_TEXT_SIZE) {
      return {
        "source": SOURCE,
        "action": "skip",
        "filename": editor.document.fileName,
        "text": "file_too_large",
        "pluginId": PLUGIN_ID,
      };
    }

    let cursorPoint = editor.selection.active;
    let cursorOffset = this.pointToOffset(text, cursorPoint);

    return {
      "source": SOURCE,
      "action": action,
      "filename": editor.document.fileName,
      "text": text,
      "pluginId": PLUGIN_ID,
      "selections": [{
        "start": cursorOffset,
        "end": cursorOffset,
      }],
    };
  }

  pointToOffset (text, point) {
    let lines = text.split("\n");
    var total = 0;

    for (var i = 0; i < lines.length && i < point.line; i++) {
      total += lines[i].length;
    }

    total += point.character + point.line;
    return total;
  }

  // Sends an event to Kite.
  sendEvent (action) {
    let event = this.buildKiteEvent(action);
    this.httpRoundTrip('/clientapi/editor/event', event);
  }

  // Sends an error to Kite.
  sendError (msg) {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      return;
    }

    this.httpRoundTrip('/clientapi/editor/error', {
      'source': SOURCE,
      'filename': editor.document.fileName,
      'text': msg,
    });
  }

  // httpRoundTrip - performs a POST request and discards the result
  httpRoundTrip (endpoint, obj) {
    var payload = JSON.stringify(obj);
    if (payload.length > MAX_PAYLOAD_SIZE) {
      console.log("unable to send message because length exceeded limit");
      reset();
      return;
    }

    var options = {
      host: '127.0.0.1',
      port: '46624',
      path: endpoint,
      method: 'POST',
    };

    var req = http.request(options);
    req.write(payload);
    req.end();
  }

  // Fired on any edit event.
  onEdit (event) {
    this.sendEvent("edit");
  }

  // Fired when a user highlights or selects a keyword.
  onSelection (event) {
    this.sendEvent("selection");
  }

  // Fired when a user selects a different pane.
  onEditorChange (event) {
    this.sendEvent("focus");
  }
};

exports.deactivate = deactivate;
exports.activate = activate;
exports.KiteEventController = KiteEventController;
