import vscode from "vscode";
import open from "open";
import path from "path";

import metrics from "./metrics";

import KiteAPI from "kite-api";

export default class NotificationsManager {
  constructor() {
    this.shownNotifications = {};
  }

  showErrorMessage(message, ...actions) {
    if (!this.shownNotifications[message]) {
      this.shownNotifications[message] = true;
      return vscode.window.showErrorMessage(message, ...actions).then(item => {
        delete this.shownNotifications[message];
        return item;
      });
    } else {
      return Promise.resolve();
    }
  }

  static getRelatedCodeErrHandler(filename, lineNo, fileName) {
    return (err) => {
      if (!err) {
        return;
      }
      const showDefaultErrMsg = () => vscode.window.showWarningMessage(
        "Oops! Something went wrong with Code Finder. Please try again later."
      );
      if (!err.data) {
        showDefaultErrMsg();
        return;
      }

      const { state, responseData } = err.data;

      if (state && state <= KiteAPI.STATES.UNREACHABLE) {
        vscode.window.showWarningMessage("Kite could not be reached. Please check that Kite engine is running.");
        return;
      }

      if (responseData && typeof responseData === 'string') {
        switch (responseData.trim()) {
          case "ErrPathNotInSupportedProject":
            vscode.window.showWarningMessage(`The file ${filename} is not in any Git project. Code finder only works inside Git projects.`);
            return;
          case "ErrProjectStillIndexing":
            vscode.window.showWarningMessage(
              "Kite is not done indexing your project yet. Please wait for the status icon to switch to ready before using Code Finder."
            );
            return;
          case "ErrEmptyLine":
            vscode.window.showWarningMessage(`Line ${lineNo} in file ${filename} is empty. Code finder only works in non-empty lines.`);
            return;
          case "ErrPathHasUnsupportedExtension": {
            const fileExt = path.extname(fileName);
            vscode.window.showWarningMessage(`Code Finder does not support the \`${fileExt}\` file extension yet.`);
            return;
          }
        }
      }

      showDefaultErrMsg();
    };
  }

  static showWelcomeNotification(config, openKiteTutorial) {
    vscode.window
      .showInformationMessage(
        "Welcome to Kite for VS Code",
        "Learn how to use Kite",
        "Don't show this again"
      )
      .then(item => {
        switch (item) {
          case "Learn how to use Kite":
            open("http://help.kite.com/category/46-vs-code-integration");
            break;
          case "Don't show this again":
            config.update("showWelcomeNotificationOnStartup", false, true);
            break;
        }
      });
    KiteAPI.getKiteSetting("has_done_onboarding")
      .then(hasDone => !hasDone && openKiteTutorial('python'));
  }

  static showKiteInstallNotification(err) {
    if (typeof err.data !== 'undefined' && err.data.state === KiteAPI.STATES.UNINSTALLED) {
      metrics.track("vscode_kite_installer_notification_shown");
      vscode.window
        .showInformationMessage(
          "Kite requires the Kite Engine backend to provide completions and documentation. Please install it to use Kite.",
          "Install"
        )
        .then(item => {
          switch (item) {
            case "Install":
              open("https://www.kite.com/install/?utm_medium=editor&utm_source=vscode");
              metrics.track("vscode_kite_installer_github_link_clicked");
              break;
          }
        });
    }
  }
}
