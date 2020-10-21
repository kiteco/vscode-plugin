const vscode = require("vscode");
const opn = require("opn");
const metrics = require("./metrics");

const KiteAPI = require("kite-api");

module.exports = class NotificationsManager {
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
            opn("http://help.kite.com/category/46-vs-code-integration");
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
              opn("https://www.kite.com/install/?utm_medium=editor&utm_source=vscode");
              metrics.track("vscode_kite_installer_github_link_clicked");
              break;
          }
        });
    }
  }
};
