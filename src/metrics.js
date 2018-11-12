'use strict';

const os = require('os');
const vscode = require('vscode');
const crypto = require('crypto');
const {Logger} = require('kite-installer');
const kitePkg = require('../package.json');
const localconfig = require('./localconfig.js');
const {metricsCounterPath} = require('./urls');

const OS_VERSION = os.type() + ' ' + os.release();

const EDITOR_UUID = vscode.env.machineId;

let Kite;

// Generate a unique ID for this user and save it for future use.
function distinctID() {
  var id = localconfig.get('distinctID');
  if (id === undefined) {
    // use the atom UUID
    id = EDITOR_UUID || crypto.randomBytes(32).toString('hex');
    localconfig.set('distinctID', id);
  }
  return id;
}

function sendFeatureMetric(name) {
  if (process.env.NODE_ENV === 'test') { return; }

  if (!Kite) { Kite = require('./kite'); }
  const path = metricsCounterPath();

  Logger.debug('feature metric:', name);

  return Kite.request({
    path,
    method: 'POST',
  }, JSON.stringify({
    name,
    value: 1,
  }));
}

function featureRequested(name) {
  sendFeatureMetric(`vscode_${name}_requested`);
}

function featureFulfilled(name) {
  sendFeatureMetric(`vscode_${name}_fulfilled`);
}

function getOsName() {
  switch (os.platform()) {
    case 'darwin': return 'macos';
    case 'win32': return 'windows';
    default: return '';
  }
}

module.exports = {
  distinctID,
  EDITOR_UUID,
  OS_VERSION,
  featureRequested,
  featureFulfilled,
  getOsName,
  version: kitePkg.version,
  track: () => {}
};
