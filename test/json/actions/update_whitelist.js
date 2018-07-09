'use strict';

const {jsonPath} = require('../utils');
const {updateWhitelist} = require('../../helpers');

module.exports = (action) => {
  beforeEach(() => { 
    updateWhitelist(action.properties.whitelist.map(jsonPath));
  });
};
