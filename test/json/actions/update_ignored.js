'use strict';

const {jsonPath} = require('../utils');
const {updateKitePaths} = require('kite-api/test/helpers/kite');

module.exports = (action) => {
  beforeEach(() => { 
    updateKitePaths({
      ignored: action.properties.ignored.map(jsonPath),
    });
  });
};
