'use strict';

const vscode = require('vscode');
const opn = require('opn');
const {StateController, Logger} = require('kite-installer');
const {PYTHON_MODE} = require('./constants');
const KiteHoverProvider = require('./hover');
const KiteCompletionProvider = require('./completion');
const KiteSignatureProvider = require('./signature');
const KiteDefinitionProvider = require('./definition');
const KiteRouter = require('./router');
const EditorEvents = require('./events');
const metrics = require('./metrics');
const {openDocumentationInWebURL} = require('./urls');

module.exports = {
  activate(ctx) {
    // send the activated event
    metrics.track('activated');

    const router = new KiteRouter();
    Logger.LEVEL = Logger.LEVELS.DEBUG;

    ctx.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('kite-vscode-internal', router));

    this.editorEventsByEditor = new Map();
    StateController.handleState().then(state => {
      if (state === StateController.STATES.UNSUPPORTED) {
        if (!StateController.isOSSupported()) {
          metrics.track('OS unsupported');
        } else if (!StateController.isOSVersionSupported()) {
          metrics.track('OS version unsupported');
        }
      }

      if (state >= StateController.STATES.AUTHENTICATED) {
        ctx.subscriptions.push(vscode.languages.registerHoverProvider(PYTHON_MODE, new KiteHoverProvider()));
        ctx.subscriptions.push(vscode.languages.registerDefinitionProvider(PYTHON_MODE, new KiteDefinitionProvider()));
        ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider(PYTHON_MODE, new KiteCompletionProvider(), '.'));
        ctx.subscriptions.push(vscode.languages.registerSignatureHelpProvider(PYTHON_MODE, new KiteSignatureProvider(), '(', ','));
      }

      ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {
        if (!this.editorEventsByEditor.has(e)) {
          this.editorEventsByEditor.set(vscode.window.activeTextEditor, new EditorEvents(vscode.window.activeTextEditor));
        }

        const evt = this.editorEventsByEditor.set(e);
        evt.focus();
      }));

      ctx.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e => {
        const evt = this.editorEventsByEditor.get(e.textEditor);
        evt.selectionChanged();
      }));

      ctx.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        const doc = e.document;
        vscode.window.visibleTextEditors.forEach(e => {
          const textEditor = e
          if (e.document === doc) {
            const evt = this.editorEventsByEditor.get(textEditor);
            evt.edit();
          }
        })
      }));
      
      vscode.commands.registerCommand('kite.more', ({id, source}) => {
        metrics.track(`${source} See info clicked`);
        const uri = `kite-vscode-internal://value/${id}`;
        router.navigate(uri);
      });

      vscode.commands.registerCommand('kite.more-range', ({range, source}) => {
        metrics.track(`${source} See info clicked`);
        const uri = `kite-vscode-internal://value-range/${JSON.stringify(range)}`;
        router.navigate(uri);
      });

      vscode.commands.registerCommand('kite.navigate', (path) => {
        const uri = `kite-vscode-internal://${path}`;
        router.navigate(uri);
      });
      
      vscode.commands.registerCommand('kite.web', ({id, source}) => {
        metrics.track(`${source} Open in web clicked`);
        opn(openDocumentationInWebURL(id, true));
      });

      vscode.commands.registerCommand('kite.def', ({file, line, source}) => {
        metrics.track(`${source} Go to definition clicked`);
        vscode.workspace.openTextDocument(file).then(doc => {
          vscode.window.visibleTextEditors.some(e => {
          if (e.document === doc) {
            e.revealRange(new vscode.Range(
              new vscode.Position(line - 1, 0),
              new vscode.Position(line - 1, 100)
            ))
          }
        })
        })
      });

      if (vscode.window.activeTextEditor) {
        const evt = new EditorEvents(vscode.window.activeTextEditor);
        this.editorEventsByEditor.set(vscode.window.activeTextEditor, evt);

        evt.focus();
      }
    }).catch(err => {
      console.error(err);
    });
  },
  
  deactivate() {
    // send the activated event
    metrics.track('deactivated');
  },
}