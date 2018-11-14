'use strict';

const path = require('path');
const {updateKitePaths} = require('kite-api/test/helpers/kite');

module.exports = ({action, path}) => {
  beforeEach('updating mock kited ignore list', () => { 
    updateKitePaths({
      ignored: action.properties.ignored.map(p => path.join(root(), p)),
    });
  });
};
