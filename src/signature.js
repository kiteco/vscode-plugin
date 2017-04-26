'use strict';
const {SignatureHelp, SignatureInformation, ParameterInformation} = require('vscode');
const {StateController, Logger} = require('kite-installer');
const {MAX_FILE_SIZE} = require('./constants');
const {promisifyRequest, promisifyReadResponse, parseJSON, compact} = require('./utils');
const {signaturePath} = require('./urls');

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
      filename: document.fileName,
      cursor_runes: cursorPosition,
      localtoken: StateController.client.LOCAL_TOKEN,
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
      help.signatures = signatures.map(sig => {
        const label = `${callee.repr}(${compact(sig.args.map(p => `${p.name}:${compact(p.types.map(t => t.name)).join('|')}`)).join(', ')})`
        const info = new SignatureInformation(label);
        info.parameters = sig.args.map(p => {
          const label = `${p.name}:${compact(p.types.map(t => t.name)).join('|')}`
          const param = new ParameterInformation(label);
          return param;
        });
        return info;
      }).slice(0, 1);

      return help;
    })
    .catch(err => {
      console.error(err);
      return [];
    });
  }
}