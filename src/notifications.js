import vscode from "vscode";
import open from "open";

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

  // notifyFromError takes an error from a request and parses it
  // If it matches the expected presentational API, it will notify
  // It returns whether it sent a notification
  static async notifyFromError(err) {
    if (!err.data) {
      return false
    }

    const { state, responseData } = err.data;
    if (!responseData) {
      return false;
    }

    if (state && state <= KiteAPI.STATES.UNREACHABLE) {
      vscode.window.showWarningMessage("Kite could not be reached. Please check that Kite engine is running.");
      return true;
    }

    try {
      const { notification: notif, message } = JSON.parse(responseData);
      if (notif) {
        // Since warning messages don't have a title, join it with body
        let title = notif.title;
        if (title !== "" && !title.endsWith('.')) {
          title += ".";
        }
        const buttonsText = notif.buttons.map(button => button.text)
        vscode.window
          .showWarningMessage([title, notif.body].join(" "), ...buttonsText)
          .then(selectedText => {
            const selectedButton = notif.buttons.find(button => button.text == selectedText);
            switch(selectedButton.action) {
              case "open":
                open(selectedButton.link)
              case "dismiss":
                // no-op closes
            }
          })
        return true;
      } else if (message) {
        vscode.window.showWarningMessage(message);
        return true;
      }
    } catch (e) {
      console.log(e);
    }
    return false;
  }

  static getRelatedCodeErrHandler() {
    return (err) => {
      if (!err) {
        return;
      }
      const notified = NotificationsManager.notifyFromError(err);
      if (!notified) {
        vscode.window.showWarningMessage(
          "Oops! Something went wrong with Code Finder. Please try again later."
        )
      }
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
