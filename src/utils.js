'use strict';

const compact = a => a.filter(v => v && v !== '');

const uniq = a => a.reduce((m, v) => m.indexOf(v) === -1 ? m.concat(v) : m, []);

const flatten = a =>
  a.reduce((m, o) => m.concat(Array.isArray(o) ? flatten(o) : o), []);

const head = a => a[0];
const last = a => a[a.length - 1];
const log = v => (console.log(v), v);

const truncate = (s, l = 200) =>
  s && s.length > l
    ? s.slice(0, l) + '…'
    : s;

function parseJSON(data, fallback) {
  try {
    return JSON.parse(data);
  } catch (e) {
    return fallback;
  }
}

// get time in seconds since the date
function secondsSince(when) {
  var now = new Date();
  return (now.getTime() - when.getTime()) / 1000.0;
}

function promisifyRequest(request) {
  return request.then
    ? request
    : new Promise((resolve, reject) => {
      request.on('response', resp => resolve(resp));
      request.on('error', err => reject(err));
    });
}

function promisifyReadResponse(response) {
  return new Promise((resolve, reject) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => resolve(data));
    response.on('error', err => reject(err));
  });
}

function delayPromise(factory, timeout) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      factory().then(resolve, reject);
    }, timeout);
  });
}

function bufferPositionForMouseEvent(editorElement, event) {
  return editorElement.getModel().bufferPositionForScreenPosition(screenPositionForMouseEvent(editorElement, event));
}

function screenPositionForMouseEvent(editorElement, event) {
  const pixelPosition = pixelPositionForMouseEvent(editorElement, event);

  if (pixelPosition == null) { return null; }

  return editorElement.screenPositionForPixelPosition != null
    ? editorElement.screenPositionForPixelPosition(pixelPosition)
    : editorElement.getModel().screenPositionForPixelPosition(pixelPosition);
}

function screenPositionForPixelPosition(editorElement, position) {
  if (position == null) { return null; }

  position = pixelPositionInEditorCoordinates(editorElement, position);

  return editorElement.screenPositionForPixelPosition != null
    ? editorElement.screenPositionForPixelPosition(position)
    : editorElement.getModel().screenPositionForPixelPosition(position);
}

function pixelPositionInEditorCoordinates(editorElement, position) {
  const {left: x, top: y} = position;
  const scrollTarget = editorElement.getScrollTop != null
    ? editorElement
    : editorElement.getModel();

  if (editorElement.querySelector('.lines') == null) { return null; }

  let {top, left} = editorElement.querySelector('.lines').getBoundingClientRect();
  top = (y - top) + scrollTarget.getScrollTop();
  left = (x - left) + scrollTarget.getScrollLeft();
  return {top, left};
}

function pixelPositionForMouseEvent(editorElement, event) {
  const {clientX: left, clientY: top} = event;

  return pixelPositionInEditorCoordinates(editorElement, {top, left});
}

const stopPropagationAndDefault = f => function(e) {
  e.stopPropagation();
  e.preventDefault();
  return f && f.call(this, e);
};

module.exports = {
  bufferPositionForMouseEvent,
  compact,
  delayPromise,
  flatten,
  head,
  last,
  log,
  parseJSON,
  pixelPositionForMouseEvent,
  promisifyReadResponse,
  promisifyRequest,
  screenPositionForMouseEvent,
  screenPositionForPixelPosition,
  secondsSince,
  stopPropagationAndDefault,
  truncate,
  uniq,
};
