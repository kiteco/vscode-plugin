'use strict';

const {parseJSON} = require('./utils');
const {membersPath} = require('./urls');
const {renderMembersList} = require('./html-utils');
let Kite;

module.exports = {
  render(id) {
    if (!Kite) { Kite = require('./kite'); }
    const path = membersPath(id);

    return Kite.request({path})
    .then(report => parseJSON(report))
    .then(data => renderMembersList(data));
  }
}