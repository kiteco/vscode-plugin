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
  // using the message. Otherwise it notifies using the defaultMessage
  // if it's passed one.
  static async notifyFromError(err, defaultMessage) {
    function tryNotifyDefault() {
      if (defaultMessage) {
        vscode.window.showWarningMessage(defaultMessage)
      }
    }
    if (!err.data) {
      tryNotifyDefault()
      return
    }

    const { state, responseData } = err.data;
    if (!responseData) {
      tryNotifyDefault()
      return
    }

    if (state && state <= KiteAPI.STATES.UNREACHABLE) {
      vscode.window.showWarningMessage("Kite could not be reached. Please check that Kite engine is running.");
      return;
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
      } else if (message) {
        vscode.window.showWarningMessage(message);
      } else {
        tryNotifyDefault();
      }
    } catch {
      tryNotifyDefault();
    }
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

  static showKiteInstallNotification(install) {
    metrics.track("vscode_kite_installer_notification_shown");
    vscode.window
      .showInformationMessage(
        "Kite requires the Kite Copilot desktop application to provide completions and documentation. Please install it to use Kite.",
        "Install",
        "Learn More"
      )
      .then(item => {
        switch (item) {
          case "Install":
            if (!install) {
              open("https://www.kite.com/install/?utm_medium=editor&utm_source=vscode");
              metrics.track("vscode_kite_installer_github_link_clicked")
            } else {
              install();
            }
            break;
          case "Learn More":
            open("https://www.kite.com/copilot/");
            break;
        }
      });
  }

  static showKiteDownloadingNotification() {
    metrics.track("vscode_kite_downloading_notification_shown");
    vscode.window
      .showInformationMessage(
        "Kite ships with a standalone application called the Copilot that can show you documentation while you code. The Copilot will launch automatically after Kite is finished installing.",
        "OK",
        "Learn More"
      )
      .then(item => {
        switch (item) {
          case "OK":
            break;
          case "Learn More":
            open("https://www.kite.com/copilot/");
            break;
        }
      });
  }

  static showKiteInstallErrorNotification(error) {
    metrics.track("vscode_kite_downloading_failed_notification_shown", { error });
    vscode.window
      .showErrorMessage(
        "There was an error installing the Kite Copilot, which is required for Kite to provide completions and documentation. Please install it to use Kite.",
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
