'use strict';

const {jsonPath} = require('../utils');
const {updateKitePaths} = require('kite-api/test/helpers/kite');

module.exports = (action) => {
  beforeEach(() => { 
    updateKitePaths({
      blacklist: action.properties.blacklist.map(p => jsonPath(p)),
    });
  });
};
