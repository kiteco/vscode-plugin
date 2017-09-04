'use strict';
const {SignatureHelp, SignatureInformation, ParameterInformation} = require('vscode');
const {StateController, Logger} = require('kite-installer');
const {MAX_FILE_SIZE} = require('./constants');
const {promisifyRequest, promisifyReadResponse, parseJSON, compact, stripTags, getFunctionDetails} = require('./utils');
const {signaturePath, normalizeDriveLetter} = require('./urls');
const {valueLabel, parameterType} = require('./data-utils');


module.exports = class KiteSignatureProvider {
  constructor(Kite) {
    this.Kite = Kite;
  }

  provideSignatureHelp(document, position, token) {
    const text = document.getText();

    if (text.length > MAX_FILE_SIZE) {
      Logger.warn('buffer contents too large, not attempting signature');
      return Promise.resolve([]);
    }

    const cursorPosition = document.offsetAt(position);
    const payload = {
      text,
      editor: 'vscode',
      filename: normalizeDriveLetter(document.fileName),
      cursor_runes: cursorPosition,
    };
    Logger.debug(payload);

    return promisifyRequest(StateController.client.request({
      path: signaturePath(),
      method: 'POST',
    }, JSON.stringify(payload)))
    .then(resp => {
      this.Kite.handle403Response(document, resp);
      Logger.logResponse(resp);
      //   Kite.handle403Response(editor, resp);
      if (resp.statusCode !== 200) {
        return promisifyReadResponse(resp).then(data => {
          throw new Error(`Error ${resp.statusCode}: ${data}`);
        });
      } else {
        return promisifyReadResponse(resp);
      }
    })
    .then(data => {
      data = parseJSON(data, {});

      const [call] = data.calls;

      const {callee, signatures} = call;
      
      const help = new SignatureHelp();
      help.activeParameter = call.arg_index;
      help.activeSignature = 0;

      const label = stripTags(valueLabel(callee));
      const sig = new SignatureInformation(label);
      const detail = getFunctionDetails(callee);
      sig.parameters = (detail.parameters || []).map(p => {
        const label = p.inferred_value
          ? `${p.name}:${stripTags(parameterType(p))}`
          : p.name
        const param = new ParameterInformation(label);
        return param;
      });

      help.signatures = [sig];

      return help;
    })
    .catch(err => null);
  }
}