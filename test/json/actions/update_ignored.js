'use strict';

const {jsonPath} = require('../utils');
const {updateIgnored} = require('../../helpers');

module.exports = (action) => {
  beforeEach(() => { 
    updateIgnored(action.properties.ignored.map(jsonPath));
  });
};
