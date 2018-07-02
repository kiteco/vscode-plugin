'use strict';

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const base = path.resolve(__dirname, '..');

function jsonPath(p) {
  return path.join(base, '..', 'node_modules', 'editors-json-tests', p);
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

function substituteFromContext(data, context) {
  let string = JSON.stringify(data);

  string = string.replace(/<<([^>]+)>>/g, (m, k) => readValueAtPath(k, context))

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

function buildContextForEditor(e) {
  return {
    plugin: 'vscode',
    editor: {
      filename: e.document.fileName,
      filename_escaped: cleanPath(e.document.fileName),
    }
  }
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
  buildContextForEditor,
  itForExpectation,
  describeForTest,
};
