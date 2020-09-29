"use strict";
const {
  SignatureHelp,
  SignatureInformation,
  ParameterInformation
} = require("vscode");
const Logger = require("kite-connector/lib/logger");
const { parseJSON, stripTags, getFunctionDetails } = require("./utils");
const { signaturePath, normalizeDriveLetter } = require("./urls");
const { valueLabel, parameterType } = require("./data-utils");
const KiteAPI = require("kite-api");

module.exports = class KiteSignatureProvider {
  constructor(Kite, isTest) {
    this.Kite = Kite;
    this.isTest = isTest;
  }

  provideSignatureHelp(document, position) {
    const text = document.getText();
    return KiteAPI.getMaxFileSizeBytes().then(max => {
      if (text.length > max) {
        return Promise.resolve();
      }
      const cursorPosition = document.offsetAt(position);
      const payload = {
        text,
        editor: "vscode",
        filename: normalizeDriveLetter(document.fileName),
        cursor_runes: cursorPosition,
        offset_encoding: "utf-16"
      };
      Logger.debug(payload);

      return this.Kite.request(
        {
          path: signaturePath(),
          method: "POST"
        },
        JSON.stringify(payload),
        document
      )
        .then(data => {
          data = parseJSON(data, {});

          const [call] = data.calls;

          const { callee } = call;

          const help = new SignatureHelp();
          help.activeParameter = call.arg_index;
          help.activeSignature = 0;

          const label = "⟠ " + stripTags(valueLabel(callee));
          const sig = new SignatureInformation(label);
          const detail = getFunctionDetails(callee);
          sig.parameters = (detail.parameters || []).map(p => {
            const label = p.inferred_value
              ? `${p.name}:${stripTags(parameterType(p))}`
              : p.name;
            const param = new ParameterInformation(label);
            return param;
          });

          if (
            Array.isArray(detail.return_value) &&
            detail.return_value.length &&
            detail.return_value[0].type
          ) {
            sig.documentation = `Returns → ${detail.return_value[0].type}`;
          }

          help.signatures = [sig];

          return help;
        })
        .catch(() => null);
    });
  }
};
