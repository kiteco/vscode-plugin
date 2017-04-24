'use strict';

const vscode = require('vscode');
const {Hover} = vscode;
const {StateController, Logger} = require('kite-installer');
const {hoverPath} = require('./urls');
const {promisifyReadResponse, compact, head, truncate} = require('./utils');
const {symbolLabel, symbolType, symbolId} = require('./data-utils');

module.exports = class KiteHoverProvider {
  provideHover(doc, pos) {
    const range = doc.getWordRangeAtPosition(pos);
    const path = hoverPath(doc, range);
    return StateController.client.request({path})
    .then(resp => {
      if (resp.statusCode !== 200) {
        return promisifyReadResponse(resp).then(data => {
          throw new Error(`bad status ${resp.statusCode}: ${data}`);
        })
      }
      return promisifyReadResponse(resp);
    })
    .then(data => JSON.parse(data))
    .then(data => {
      if (data && data.symbol && data.symbol.length) {
        const [symbol] = data.symbol;
        const id = symbolId(symbol);
        const texts = [{
            language: 'python', 
            value: `${symbolLabel(symbol)}${symbolType(symbol)}`
          }, 
          truncate(data.report && data.report.documentation_text),
          truncate(symbol.synopsis),
          truncate(symbol.value && symbol.value.length && head(symbol.value).synopsis),
        ];

        const links = [];

        if (data && data.report && data.report.definition && data.report.definition.filename !== '') {
          const defData = JSON.stringify({
            file: data.report.definition.filename,
            line: data.report.definition.line,
            source: 'Hover',
          });
          links.push(`[def](command:kite.def?${defData})`);
        }

        if (id && id !== '') {
          const linkData = JSON.stringify({
            id,
            source: 'Hover',
          });

          
          links.push(`[web](command:kite.web?${linkData})`);
          links.push(`[more](command:kite.more?${linkData})`);
        }

        if (links.length) { texts.push(links.join(' ')); }

        return new Hover(compact(texts));
      }
    })
    .catch(err => {
      Logger.error(err);
      return null;
    });
  }
}