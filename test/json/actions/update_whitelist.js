'use strict';

const {jsonPath} = require('../utils');
const {updateKitePaths} = require('kite-api/test/helpers/kite');

module.exports = (action) => {
  beforeEach(() => { 
    updateKitePaths({
      whitelist: action.properties.whitelist.map(jsonPath),
    });
  });
};
