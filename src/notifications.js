"use strict";

const vscode = require("vscode");
const { kiteOpen } = require("./utils");
const config = vscode.workspace.getConfiguration("kite");

var hasSeenGoBetaNotification = false;
const showGoBetaNotification = () => {
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

var hasSeenJSBetaNotification = false;
const showJSBetaNotification = () => {
    if (config.showJSBetaNotification &&
        !hasSeenJSBetaNotification) {
        vscode.window
            .showInformationMessage(
                "Welcome to the Kite for JavaScript Beta! You\'ve got early access to our line-of-code completions for JavaScript, powered by machine learning. If you\'d like to disable the beta, you can do so in the Copilot.",
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
                            config.update("showJSBetaNotification", false, true);
                            break;
                    }
                }
            });
        hasSeenJSBetaNotification = true;
    }
};

module.exports = {
    showGoBetaNotification,
    showJSBetaNotification
};
