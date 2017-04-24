'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {Logger} = require('kite-installer');
const configPath = path.join(os.homedir(), '.kite', 'kite-config.json');

var config = null;

(function() {
  try {
    Logger.verbose(`initializing localconfig from ${ configPath }...`);
    var str = fs.readFileSync(configPath, {encoding: 'utf8'});
    config = JSON.parse(str);
  } catch (err) {
    config = {};
  }
})();

function persist() {
  var str = JSON.stringify(config, null, 2); // serialize with whitespace for human readability
  fs.writeFile(configPath, str, 'utf8', (err) => {
    if (err) {
      Logger.error(`failed to persist localconfig to ${ configPath }`, err);
    }
  });
}

// get gets a value from storage
function get(key, fallback) {
  return key in config ? config[key] : fallback;
}

// set assigns a value to storage and asynchronously persists it to disk
function set(key, value) {
  config[key] = value;
  persist();   // will write to disk asynchronously
}

module.exports = {
  get: get,
  set: set,
};
