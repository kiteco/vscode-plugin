"use strict";

const vscode = require("vscode");
const { kiteOpen } = require("./utils");

var hasSeenGoBetaNotification = false;
const showGoBetaNotification = () => {
    const config = vscode.workspace.getConfiguration("kite");
    if (config.showGoBetaNotification &&
        !hasSeenGoBetaNotification) {
        vscode.window
            .showInformationMessage(
                "Welcome to the Kite for Go Beta! You\'ve got early access to our line-of-code completions for Go, powered by machine learning. If you\'d like to disable the beta, you can do so in the Copilot.",
                "Open Copilot",
                "Hide Forever"
            )
            .then(item => {
                if (item) {
                    switch (item) {
                        case "Open Copilot":
                            kiteOpen("kite://home");
                            break;
                        case "Hide Forever":
                            config.update("showGoBetaNotification", false, true);
                            break;
                    }
                }
            });
        hasSeenGoBetaNotification = true;
    }
};

module.exports = {
    showGoBetaNotification
};