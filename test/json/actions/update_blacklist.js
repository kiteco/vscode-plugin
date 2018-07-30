'use strict';

const {jsonPath} = require('../utils');
const {updateBlacklist} = require('../../helpers');

module.exports = (action) => {
  beforeEach(() => { 
    updateBlacklist(action.properties.blacklist.map(jsonPath));
  });
};
