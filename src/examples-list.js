'use strict';

const {parseJSON} = require('./utils');
const {valueReportPath} = require('./urls');
const {renderExamplesList} = require('./html-utils');
let Kite;

module.exports = {
  render(id) {
    if (!Kite) { Kite = require('./kite'); }
    const path = valueReportPath(id);

    return Kite.request({path})
    .then(report => parseJSON(report))
    .then(data => renderExamplesList(data));
  }
}