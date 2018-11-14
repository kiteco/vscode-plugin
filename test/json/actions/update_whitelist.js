'use strict';

const path = require('path');
const {updateKitePaths} = require('kite-api/test/helpers/kite');

module.exports = ({action, root}) => {
  beforeEach('updating mock kited whitelist', () => { 
    updateKitePaths({
      whitelist: action.properties.whitelist.map(p => path.join(root(), p)),
    });
  });
};
