"use strict";

import vscode from 'vscode';
import os from 'os';
import open from 'open';

import KiteAPI from "kite-api";
import Logger from "kite-connector/lib/logger";
import {
  ERROR_COLOR,
  IsEnabledAndSupported,
  CompletionsSupport,
  PythonFullCompletionsSupport,
  PythonDefinitionsSupport,
  PythonHoverSupport,
  PythonSignaturesSupport,
  IsSupportedFile,
} from "./constants";
import KiteHoverProvider from "./hover";
import KiteCompletionProvider from "./completion";
import KiteSignatureProvider from "./signature";
import KiteDefinitionProvider from "./definition";
import KiteEditor from "./kite-editor";
import EditorEvents from "./events";
import NotificationsManager from "./notifications";
import localconfig from "./localconfig";
import metrics from "./metrics";
import { statusPath, hoverPath } from "./urls";
import Rollbar from "rollbar";
import {
  editorsForDocument,
  promisifyReadResponse,
  kiteOpen
} from "./utils";
import { version } from "../package.json";
import { DEFAULT_MAX_FILE_SIZE } from "kite-api";

const RUN_KITE_ATTEMPTS = 30;
const RUN_KITE_INTERVAL = 2500;

export const Kite = {
  maxFileSize: DEFAULT_MAX_FILE_SIZE,

  activate(ctx) {
    this.globalState = ctx.globalState;
    if (process.env.NODE_ENV !== "test") {
      this._activate();
      ctx.subscriptions.push(this);
    }
  },

  _activate() {
    if (this.globalState.setKeysForSync) {
      this.globalState.setKeysForSync(["kite.showWelcomeNotificationOnStartup"]);
    }

    metrics.featureRequested("starting");

    this.reset();

    const rollbar = new Rollbar({
      accessToken: "4ca1bfd4721544e487c76583478a436a",
      payload: {
        environment: process.env.NODE_ENV,
        editor: "vscode",
        kite_plugin_version: version,
        os: os.type() + " " + os.release()
      }
    });

    const tracker = err => {
      if (err.stack.indexOf("kite") > -1) {
        rollbar.error(err);
      }
    };
    process.on("uncaughtException", tracker);
    this.disposables.push({
      dispose() {
        process.removeListener("uncaughtException", tracker);
      }
    });

    Logger.LEVEL =
      Logger.LEVELS[
        vscode.workspace.getConfiguration("kite").loggingLevel.toUpperCase()
      ];

    KiteAPI
      .isKiteInstalled()
      .catch(NotificationsManager.showKiteInstallNotification);

    this.setMaxFileSize();

    this.disposables.push(
      vscode.languages.registerHoverProvider(
        PythonHoverSupport(),
        new KiteHoverProvider(Kite)
      )
    );
    this.disposables.push(
      vscode.languages.registerDefinitionProvider(
        PythonDefinitionsSupport(),
        new KiteDefinitionProvider(Kite)
      )
    );

    var completionsTriggers = ['.', '"', '\'', '`', '('];
    var optionalCompletionsTriggers = [' ', '['];

    this.disposables.push(
      vscode.languages.registerCompletionItemProvider(
        CompletionsSupport(),
        new KiteCompletionProvider(Kite, completionsTriggers, optionalCompletionsTriggers), ...completionsTriggers.concat(optionalCompletionsTriggers))
    );

    // More triggers for Python because we have semantic completions.
    // We leave out open quotes because we can't suggest string constants.
    var pythonCompletionsTriggers = ['.', ',', ' ', '(', '[', '{', '='];

    this.disposables.push(
      vscode.languages.registerCompletionItemProvider(
        PythonFullCompletionsSupport(),
        new KiteCompletionProvider(Kite, pythonCompletionsTriggers), ...pythonCompletionsTriggers)
    );

    this.disposables.push(
      vscode.languages.registerSignatureHelpProvider(
        PythonSignaturesSupport(),
        new KiteSignatureProvider(Kite),
        "(",
        ","
      )
    );

    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(() => {
        Logger.LEVEL =
          Logger.LEVELS[
            vscode.workspace.getConfiguration("kite").loggingLevel.toUpperCase()
          ];
      })
    );

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(e => {
        this.setMaxFileSize();
        this.setStatusBarLabel();
        if (e) {
          if (/Code[/\\]User[/\\]settings.json$/.test(e.document.fileName)) {
            metrics.featureRequested("settings");
            metrics.featureFulfilled("settings");
          }
          if (this.isGrammarSupported(e)) {
            this.registerEvents(e);
            this.registerEditor(e);
          }

          const evt = this.eventsByEditor.get(e.document.fileName);
          evt && evt.focus();
        }
      })
    );

    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(e => {
        const evt = this.eventsByEditor.get(e.textEditor.document.fileName);
        evt && evt.selectionChanged();
      })
    );

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(e => {
        e.document &&
          editorsForDocument(e.document).forEach(e => {
            const evt = this.eventsByEditor.get(e.document.fileName);
            evt && evt.edit();
          });
      })
    );

    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(editors => {
        editors.forEach(e => {
          if (IsSupportedFile(e.document.fileName)) {
            this.registerDocumentEvents(e.document);
            this.registerDocument(e.document);
          }
        });
      })
    );

    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right
    );
    this.statusBarItem.text = "𝕜𝕚𝕥𝕖";
    this.statusBarItem.color = undefined;
    this.statusBarItem.show();

    this.disposables.push(this.statusBarItem);

    this.disposables.push(
      vscode.commands.registerCommand("kite.insert-completion", ({ lang, completion }) => {
        metrics.increment(`vscode_kite_${lang}_completions_inserted`);
        metrics.increment(`kite_${lang}_completions_inserted`);
        metrics.sendCompletionSelected(lang, completion).catch(e => { console.error(e); });
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand("kite.login", () => {
        kiteOpen("kite://home");
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand("kite.open-settings", () => {
        kiteOpen("kite://settings");
      })
    );

    this.disposables.push(
      vscode.commands.registerTextEditorCommand("kite.related-code-from-file", (textEditor) => {
        KiteAPI
          .requestRelatedCode("vscode", vscode.env.appRoot, textEditor.document.fileName)
          .catch(NotificationsManager.getRelatedCodeErrHandler());
      })
    );

    this.disposables.push(
      vscode.commands.registerTextEditorCommand("kite.related-code-from-line", (textEditor) => {
        const zeroBasedLineNo = textEditor.selection.active.line;
        const oneBasedLineNo = zeroBasedLineNo+1;
        KiteAPI
          .requestRelatedCode("vscode", vscode.env.appRoot, textEditor.document.fileName, oneBasedLineNo)
          .catch(NotificationsManager.getRelatedCodeErrHandler(textEditor.document.fileName, oneBasedLineNo));
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand("kite.open-copilot", () => {
        kiteOpen("kite://home");
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand("kite.more", ({ id, source }) => {
        metrics.track(`${source} See info clicked`);
        kiteOpen(`kite://docs/${id}`);
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "kite.more-position",
        ({ position, source }) => {
          metrics.track(`${source} See info clicked`);
          const doc = vscode.window.activeTextEditor.document;
          const path = hoverPath(doc, position);
          return this.request({ path })
            .then(data => JSON.parse(data))
            .then(data => {
              kiteOpen(`kite://docs/${data.symbol[0].id}`);
            });
        }
      )
    );

    this.disposables.push(
      vscode.commands.registerCommand("kite.web-url", url => {
        open(url.replace(/;/g, "%3B"));
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "kite.def",
        ({ file, line, character, source }) => {
          metrics.track(`${source} Go to definition clicked`);
          metrics.featureRequested("definition");
          vscode.workspace
            .openTextDocument(vscode.Uri.file(file))
            .then(doc => {
              return vscode.window.showTextDocument(doc);
            })
            .then(e => {
              metrics.featureFulfilled("definition");
              const newPosition = new vscode.Position(
                line - 1,
                character ? character - 1 : 0
              );
              e.revealRange(
                new vscode.Range(
                  newPosition,
                  new vscode.Position(line - 1, 100)
                )
              );

              const newSelection = new vscode.Selection(
                newPosition,
                newPosition
              );
              e.selection = newSelection;
            });
        }
      )
    );

    const openKiteTutorial = async language => {
      try {
        const path = await KiteAPI.getOnboardingFilePath("vscode", language);
        const tutorial = await vscode.workspace.openTextDocument(path);
        vscode.window.showTextDocument(tutorial);
        KiteAPI.setKiteSetting("has_done_onboarding", true);
      } catch (e) {
        this.notifications.showErrorMessage(
          "We were unable to open the tutorial. Try again later or email us at feedback@kite.com",
        );
      }
    };

    this.disposables.push(
      vscode.commands.registerCommand("kite.python-tutorial", () => {
        openKiteTutorial("python");
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand("kite.javascript-tutorial", () => {
        openKiteTutorial("javascript");
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand("kite.go-tutorial", () => {
        openKiteTutorial("go");
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand("kite.help", () => {
        open("https://help.kite.com/category/46-vs-code-integration");
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand("kite.docs-at-cursor", () => {
        const editor = vscode.window.activeTextEditor;

        if (editor) {
          const pos = editor.selection.active;
          const { document } = editor;

          const path = hoverPath(document, pos);
          KiteAPI.request({ path }).then(resp => {
            if (resp.statusCode === 200) {
              vscode.commands.executeCommand("kite.more-position", {
                position: pos,
                source: "Command"
              });
            }
          });
        }
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "kite.usage",
        ({ file, line, source }) => {
          metrics.track(`${source} Go to usage clicked`);
          metrics.featureRequested("usage");
          vscode.workspace.openTextDocument(file).then(doc => {
            metrics.featureFulfilled("usage");
            editorsForDocument(doc).some(e => {
              e.revealRange(
                new vscode.Range(
                  new vscode.Position(line - 1, 0),
                  new vscode.Position(line - 1, 100)
                )
              );
            });
          });
        }
      )
    );

    const config = vscode.workspace.getConfiguration("kite");
    if (config.showWelcomeNotificationOnStartup) {
      NotificationsManager.showWelcomeNotification(config, openKiteTutorial);
    }

    setTimeout(() => {
      vscode.window.visibleTextEditors.forEach(e => {
        if (IsSupportedFile(e.document.fileName)) {
          this.registerEvents(e);
          this.registerEditor(e);

          if (e === vscode.window.activeTextEditor) {
            const evt = this.eventsByEditor.get(e.document.fileName);
            evt && evt.focus();
          }
        }
      });

      this.checkState("activationCheck");
    }, 100);

    this.pollingInterval = setInterval(() => {
      this.checkState("pollingInterval");
    }, config.get("pollingInterval") || 5000);

    metrics.featureFulfilled("starting");

    return this;
  },

  reset() {
    this.disposables &&
      this.disposables.forEach(disposable => {
        disposable.dispose();
      });
    this.kiteEditorByEditor = new Map();
    this.eventsByEditor = new Map();
    this.shown = {};
    this.disposables = [];
    this.attemptedToStartKite = false;
    this.notifications = new NotificationsManager();
    delete this.lastState;
    delete this.lastStatus;
    delete this.lastPolledState;
    delete this.pollingInterval;
  },

  deactivate() {
    for (const [, ke] of this.kiteEditorByEditor) {
      ke && ke.dispose();
    }
    for (const [, evt] of this.eventsByEditor) {
      evt && evt.dispose();
    }
    metrics.featureRequested("stopping");
    metrics.featureFulfilled("stopping");
    this.dispose();
    this.reset();
  },

  dispose() {
    this.disposables && this.disposables.forEach(d => d.dispose());
    delete this.disposables;
  },

  registerDocument(document) {
    editorsForDocument(document).forEach(e => this.registerEditor(e));
  },

  registerDocumentEvents(document) {
    editorsForDocument(document).forEach(e => this.registerEvents(e));
  },

  registerEvents(e) {
    if (e && e.document) {
      let evt = this.eventsByEditor.get(e.document.fileName);
      if (evt && evt.editor) {
        evt.editor = e;
      } else {
        evt = new EditorEvents(this, e);
        this.eventsByEditor.set(e.document.fileName, evt);
      }
    }
  },

  registerEditor(e) {
    if (this.kiteEditorByEditor.has(e.document.fileName)) {
      const ke = this.kiteEditorByEditor.get(e.document.fileName);
      ke.editor = e;
    } else {
      Logger.debug(
        "register kite editor for",
        e.document.fileName,
        e.document.languageId
      );
      const ke = new KiteEditor(Kite, e);
      this.kiteEditorByEditor.set(e.document.fileName, ke);
    }
  },

  checkState(src) {
    return KiteAPI
      .checkHealth()
      .then(state => {
        if (state > KiteAPI.STATES.INSTALLED) {
          localconfig.set("wasInstalled", true);
        }

        switch (state) {
          case KiteAPI.STATES.UNSUPPORTED:
            if (
              this.shown[state] ||
              !this.isGrammarSupported(vscode.window.activeTextEditor)
            ) {
              return state;
            }
            this.shown[state] = true;
            if (!KiteAPI.isOSSupported()) {
              metrics.track("OS unsupported");
            } else if (!KiteAPI.isOSVersionSupported()) {
              metrics.track("OS version unsupported");
            }
            this.notifications.showErrorMessage(
              "Sorry, the Kite engine is currently not supported on your platform"
            );
            break;
          case KiteAPI.STATES.UNINSTALLED:
            if (
              this.shown[state] ||
              (vscode.window.activeTextEditor &&
                !this.isGrammarSupported(vscode.window.activeTextEditor))
            ) {
              return state;
            }
            this.shown[state] = true;
            break;
          case KiteAPI.STATES.INSTALLED:
            if (
              !this.attemptedToStartKite &&
              vscode.workspace.getConfiguration("kite").startKiteEngineOnStartup
            ) {
              KiteAPI.runKiteAndWait(RUN_KITE_ATTEMPTS, RUN_KITE_INTERVAL).then(() => this.checkState(src));
              this.attemptedToStartKite = true;
            }
            break;
          case KiteAPI.STATES.RUNNING:
            if (
              this.shown[state] ||
              !this.isGrammarSupported(vscode.window.activeTextEditor)
            ) {
              return state;
            }
            break;
          default:
            if (this.isGrammarSupported(vscode.window.activeTextEditor)) {
              this.registerEditor(vscode.window.activeTextEditor);
            }
            if (src && (src === "pollingInterval" || src === "activationCheck"))
              this.lastPolledState = state;
            return state;
        }
        //state caching for capturihg false positives in kited restart race condition
        //we do this only for checkState invocations coming from the polling or initial activation
        //script to eliminate the possible case where multiple editor events were generated quickly
        //while kited was restarting
        if (src && (src === "pollingInterval" || src === "activationCheck"))
          this.lastPolledState = state;
        return state;
      })
      .then(state => {
        this.setStatus(
          state,
          this.isGrammarSupported(vscode.window.activeTextEditor)
            ? vscode.window.activeTextEditor.document
            : null
        );
      })
      .catch(err => {
        console.error(err);
      });
  },

  setMaxFileSize() {
    KiteAPI.getMaxFileSizeBytes().then(max => {
      this.maxFileSize = max;
    });
  },

  setStatusBarLabel() {
    const state = this.lastState;
    const status = this.lastStatus;

    const supported = this.isGrammarSupported(vscode.window.activeTextEditor);
    const enabledFiletype = this.isEnabledAndSupported(vscode.window.activeTextEditor);

    if (supported) {
      this.statusBarItem.show();
      switch (state) {
        case KiteAPI.STATES.UNSUPPORTED:
          this.statusBarItem.tooltip =
            "Kite engine is currently not supported on your platform";
          this.statusBarItem.color = ERROR_COLOR();
          this.statusBarItem.text = "𝕜𝕚𝕥𝕖: not supported";
          break;
        case KiteAPI.STATES.UNINSTALLED:
          this.statusBarItem.text = "𝕜𝕚𝕥𝕖: not installed";
          this.statusBarItem.tooltip = "Kite engine is not installed";
          this.statusBarItem.color = ERROR_COLOR();
          break;
        case KiteAPI.STATES.INSTALLED:
          this.statusBarItem.text = "𝕜𝕚𝕥𝕖: not running";
          this.statusBarItem.tooltip = "Kite engine is not running";
          this.statusBarItem.color = ERROR_COLOR();
          break;
        case KiteAPI.STATES.RUNNING:
          this.statusBarItem.text = "𝕜𝕚𝕥𝕖: not reachable";
          this.statusBarItem.tooltip = "Kite engine is not reachable";
          this.statusBarItem.color = ERROR_COLOR();
          break;
        default:
          if (!enabledFiletype) {
            this.statusBarItem.color = undefined;
            this.statusBarItem.text = "𝕜𝕚𝕥𝕖: disabled";
            this.statusBarItem.tooltip = "Enable this file type in VS Code settings";
          } else if (status) {
            this.statusBarItem.color = undefined;
            this.statusBarItem.text = status.short ? ("𝕜𝕚𝕥𝕖: " + status.short) : "𝕜𝕚𝕥𝕖";
            this.statusBarItem.tooltip = status.long ? status.long : "";
          } else {
            this._clearStatusBarItem();
          }
      }
    } else {
      this._clearStatusBarItem();
    }
  },

  _clearStatusBarItem() {
    this.statusBarItem.text = "";
    this.statusBarItem.color = undefined;
    this.statusBarItem.tooltip = "";
    this.statusBarItem.hide();
  },

  setStatus(state = this.lastState, document) {
    this.lastState = state;
    this.getStatus(document).then(status => {
      this.lastStatus = status;
      this.setStatusBarLabel();
    });
  },

  isGrammarSupported(e) {
    // Whether Kite supports this file extension, regardless of user settings
    return e && e.document && IsSupportedFile(e.document.fileName);
  },

  isEnabledAndSupported(e) {
    // Takes into account whether the user has chosen to disable this file extension
    return e && e.document && IsEnabledAndSupported(e.document.fileName);
  },

  getStatus(document) {
    if (!document) {
      return Promise.resolve({ status: "ready" });
    }

    const path = statusPath(document.fileName);

    return KiteAPI.request({ path })
      .then(resp => {
        if (resp.statusCode === 200) {
          return promisifyReadResponse(resp).then(json => JSON.parse(json));
        }
      })
      .catch(() => ({ status: "ready" }));
  },

  request(req, data) {
    return KiteAPI.request(req, data).then(resp => promisifyReadResponse(resp));
  },
};


export function activate(ctx) {
  return Kite.activate(ctx);
}
export function deactivate() {
  Kite.deactivate();
}
export function request(...args) {
  return Kite.request(...args);
}
