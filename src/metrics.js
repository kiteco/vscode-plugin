"use strict";

import os from 'os';
import vscode from 'vscode';
import crypto from 'crypto';
import mixpanel from 'mixpanel';

import Logger from "kite-connector/lib/logger";
import kitePkg from "../package.json";
import localconfig from "./localconfig.js";
import { metricsCounterPath, metricsCompletionSelectedPath } from "./urls";

const OS_VERSION = os.type() + " " + os.release();

const EDITOR_UUID = vscode.env.machineId;

const MIXPANEL_TOKEN = "fb6b9b336122a8b29c60f4c28dab6d03";

import { Kite } from './kite';

const mpClient = mixpanel.init(MIXPANEL_TOKEN, {
  protocol: "https",
});

// Generate a unique ID for this user and save it for future use.
function distinctID() {
  var id = localconfig.get("distinctID");
  if (id === undefined) {
    // use the atom UUID
    id = EDITOR_UUID || crypto.randomBytes(32).toString("hex");
    localconfig.set("distinctID", id);
  }
  return id;
}

function sendCompletionSelected(lang, completion) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const path = metricsCompletionSelectedPath();

  return Kite.request(
    {
      path,
      method: "POST"
    },
    JSON.stringify({
      editor: 'vscode',
      language: lang,
      completion: completion
    })
  );
}

function sendFeatureMetric(name) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const path = metricsCounterPath();

  Logger.debug("feature metric:", name);

  return Kite.request(
    {
      path,
      method: "POST"
    },
    JSON.stringify({
      name,
      value: 1
    })
  );
}

function featureRequested(name) {
  sendFeatureMetric(`vscode_${name}_requested`);
}

function featureFulfilled(name) {
  sendFeatureMetric(`vscode_${name}_fulfilled`);
}

function getOsName() {
  switch (os.platform()) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    case "linux":
      return "linux";
    default:
      return "";
  }
}

export default {
  distinctID,
  EDITOR_UUID,
  OS_VERSION,
  featureRequested,
  featureFulfilled,
  increment: name => sendFeatureMetric(name),
  getOsName,
  sendCompletionSelected,
  version: kitePkg.version,
  track: (event, props) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`tracking ${event}`, props);
      return;
    }

    const eventData = {
      distinct_id: distinctID(),
      editor_uuid: EDITOR_UUID,
      os_name: os.type(),
      os_release: os.release(),
    };

    for(var key in props) {
      eventData[key] = props[key];
    }

    mpClient.track(event, eventData);
  },
};
