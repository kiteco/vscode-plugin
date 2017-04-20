'use strict';

const vscode = require('vscode');
const {StateController, Logger} = require('kite-installer');
const {PYTHON_MODE} = require('./constants');
const KiteHoverProvider = require('./hover');
const KiteCompletionProvider = require('./completion');
const KiteRouter = require('./router');
const EditorEvents = require('./events');

module.exports = {
  activate(ctx) {
    const router = new KiteRouter();
    Logger.LEVEL = Logger.LEVELS.DEBUG;

    ctx.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('kite-vscode-internal', router));

    this.editorEventsByEditor = new Map();
    StateController.handleState().then(state => {
      if (state >= StateController.STATES.AUTHENTICATED) {
        ctx.subscriptions.push(vscode.languages.registerHoverProvider(PYTHON_MODE, new KiteHoverProvider()));
        ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider(PYTHON_MODE, new KiteCompletionProvider(), '.'));
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
        evt.selectionChanged(e.selections);
      }));
      
      vscode.commands.registerCommand('kite.more', (id) => {
        const uri = `kite-vscode-internal://value/${id}`;
        router.navigate(uri);
      });

      vscode.commands.registerCommand('kite.navigate', (path) => {
        const uri = `kite-vscode-internal://${path}`;
        router.navigate(uri);
      });
      
      vscode.commands.registerCommand('kite.web', (id) => {
        console.log('more clicked', id);
      });

      vscode.commands.registerCommand('kite.def', (id) => {
        console.log('def clicked', id);
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
  
  deactivate() {},
}