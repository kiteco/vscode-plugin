"use strict";

const vscode = require("vscode");
var path = require('path');

const { kiteOpen } = require("./utils");
const { settingsPath } = require("./urls")
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
const showJavascriptBetaNotification = (kite) => {
    if (!config.showJavascriptBetaNotification ||
        hasSeenJSBetaNotification) {
        return
    }
    kite.request({
        path: settingsPath("kite_js_enabled"),
        method: "GET"
    }).then((isEnabled) => {
        if (isEnabled !== "true") {
            return
        }

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
                            config.update("showJavascriptBetaNotification", false, true);
                            break;
                    }
                }
            });
            hasSeenJSBetaNotification = true;
    })
};

const showNotification = (kite, filename) => {
    switch (path.extname(filename)) {
        case ".go":
            showGoBetaNotification();
            break;
        case ".js":
        case ".jsx":
        case ".vue":
            showJavascriptBetaNotification(kite);
            break;
    }
};

module.exports = {
    showNotification
};
