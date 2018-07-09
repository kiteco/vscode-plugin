'use strict';

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const base = path.resolve(__dirname, '..');
const testBase = path.join(base, '..', 'node_modules', 'editors-json-tests');
function jsonPath(p) {
  return path.join(testBase, p);
}

function walk(p, ext, callback) {
  if(typeof ext == 'function') {
    callback = ext;
    ext = undefined;
  }
  if (fs.existsSync(p)) {
    const stats = fs.lstatSync(p);

    if (stats.isDirectory()) {
      const content = fs.readdirSync(p);

      content.forEach(s => walk(path.join(p, s), callback));
    } else {
      if (!ext || path.extname(p) === ext) {
        callback(p);
      }
    }
  }
}

function readValueAtPath(path, object) {
  if (!path) { return object; }

  return path.split(/\./g).reduce((memo, key) => {
    if (memo == undefined) { return memo; }
    return memo[key];
  }, object);
}

function writeValueAtPath(path, value, object) {
  if (!object) { object = {}; }

  return path.split(/\./g).reduce((memo, key, i, a) => {
    if (i === a.length - 1) {
      memo[key] = value;
      return object;
    } else if (memo[key] == undefined) {
      memo[key] = {};
      return memo[key];
    }
    return memo[key];
  }, object);
}

function substituteFromContext(data, context) {
  let string = JSON.stringify(data);

  string = string.replace(/\$\{([^}]+)\}/g, (m, k) => readValueAtPath(k, context))

  return JSON.parse(string)
}

function cleanPath(p) {
  return encodeURI(normalizeDriveLetter(p))
  .replace(/^([a-zA-Z]):/, (m, d) => `/windows/${d}`)
  .replace(/\/|\\|%5C/g, ':');
}

function normalizeDriveLetter(str) {
  return str.replace(/^[a-z]:/, m => m.toUpperCase());
}

function buildContext() {
  const context = {
    plugin: 'vscode',
    editors: {},
  };

  vscode.window.visibleTextEditors.forEach(e => {
    const relativePath = path.relative(testBase, e.document.fileName);
    writeValueAtPath(relativePath, {
      filename: e.document.fileName,
      filename_escaped: cleanPath(e.document.fileName),
    }, context.editors);
  });

  return context;
}

function loadPayload(p) {
  let body;
  switch (typeof p) {
    case 'object':
      body = p;
      break;
    case 'string':
      body = require(jsonPath(p));
  }
  return body;
}

function itForExpectation (expectation) {
  if(expectation.ignore) {
    it.skip(expectation.description, () => {});
  } else if(expectation.focus) {
    it.only(expectation.description, () => {});
  } else {
    it(expectation.description, () => {});
  }
}

function describeForTest(test, description, block) {
  if(test.ignore) {
    describe.skip(description, block);
  } else if(test.focus) {
    describe.only(description, block);
  } else {
    describe(description, block);
  }
}

module.exports = {
  jsonPath,
  walk,
  loadPayload,
  substituteFromContext,
  buildContext,
  itForExpectation,
  describeForTest,
};
