'use strict';

const os = require('os');
const vscode = require('vscode');
const mixpanel = require('mixpanel');
const crypto = require('crypto');
const {Logger} = require('kite-installer');
const kitePkg = require('../package.json');
const localconfig = require('./localconfig.js');
const {metricsCounterPath} = require('./urls');

const MIXPANEL_TOKEN = 'fb6b9b336122a8b29c60f4c28dab6d03';

const OS_VERSION = os.type() + ' ' + os.release();

const client = mixpanel.init(MIXPANEL_TOKEN, {
  protocol: 'https',
});

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

// Send an event to mixpanel
function track(eventName, properties) {
  eventName = `vscode - ${eventName}`;

  var eventData = {
    distinct_id: distinctID(),
    editor_uuid: EDITOR_UUID,
    editor: 'vscode',
    kite_plugin_version: kitePkg.version,
    os: OS_VERSION,
  };
  for (var key in properties || {}) {
    eventData[key] = properties[key];
  }
  Logger.debug('mixpanel:', eventName, eventData);
  client.track(eventName, eventData);
}

function sendFeatureMetric(name) {
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

module.exports = {
  track,
  distinctID,
  EDITOR_UUID,
  OS_VERSION,
  featureRequested,
  featureFulfilled,
};
