"use strict";

import fs from 'fs';
import os from 'os';
import path from 'path';

import Logger from "kite-connector/lib/logger";
const legacyConfigDir = path.join(os.homedir(), ".kite");
const legacyConfigPath = path.join(legacyConfigDir, "kite-config.json");

const configDir =
  os.platform() === "win32"
    ? path.join(process.env.LOCALAPPDATA, "Kite")
    : path.join(os.homedir(), ".kite");

const configPath = path.join(configDir, "kite-vscode-config.json");

let config = null;

try {
  if (fs.existsSync(legacyConfigPath)) {
    Logger.verbose(
      `initializing localconfig from legacy path ${legacyConfigPath}.`
    );
    config = JSON.parse(
      fs.readFileSync(legacyConfigPath, { encoding: "utf8" })
    );
    fs.unlinkSync(legacyConfigPath);
    if (fs.readdirSync(legacyConfigDir).length === 0) {
      fs.rmdirSync(legacyConfigDir);
    }
  } else {
    Logger.verbose(`initializing localconfig from ${configPath}.`);
    config = JSON.parse(fs.readFileSync(configPath, { encoding: "utf8" }));
  }
} catch (err) {
  config = {};
}

function persist() {
  const str = JSON.stringify(config, null, 2); // serialize with whitespace for human readability
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
  }
  fs.writeFile(configPath, str, "utf8", err => {
    if (err) {
      Logger.error(`failed to persist localconfig to ${configPath}`, err);
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
  persist(); // will write to disk asynchronously
}

export default {
  get,
  set,
};
