'use strict';

const expect = require('expect.js')
const sinon = require('sinon');
const vscode = require('vscode');
const {substituteFromContext, buildContextForEditor} = require('../utils');
const {waitsFor} = require('../../helpers')
let stubs;

const LEVELS = {
  info: 'showInformationMessage',
  warning: 'showWarningMessage',
  warn: 'showWarningMessage',
  error: 'showErrorMessage',
}

module.exports = (expectation) => {
  beforeEach(() => {
    const spy = vscode.window[LEVELS[expectation.properties.level]]
    return waitsFor(`${expectation.properties.level} notification`, () => {
      return NotificationsMock.newNotification();
    }, 100)
  });

  const block = () => {
    expect(NotificationsMock.lastNotification.level).to.eql(expectation.properties.level)

    if(expectation.properties.message) {
      const message = substituteFromContext(expectation.properties.message, buildContextForEditor(vscode.window.activeTextEditor))

      expect(NotificationsMock.lastNotification.message).to.eql(message);
    }
  }

  if(expectation.focus) {
    it.only(expectation.description, block);
  } else {
    it(expectation.description, block);
  }
}

const NotificationsMock = {
  initialize() {
    this.notifications = []
    this.stubs = [
      sinon.stub(vscode.window, 'showInformationMessage').callsFake((...args) => this.registerNotification('info', ...args)),
      sinon.stub(vscode.window, 'showWarningMessage').callsFake((...args) => this.registerNotification('warning', ...args)),
      sinon.stub(vscode.window, 'showErrorMessage').callsFake((...args) => this.registerNotification('error', ...args)),
    ];
    this.initialized = true;
  },
  cleanup() {
    this.notifications = [];
    delete this.lastNotification;
  },
  newNotification() {
    const lastNotification = this.notifications[this.notifications.length - 1];
    const created = lastNotification != this.lastNotification;

    if(created) {
      this.lastNotification = lastNotification;
    }
    return created;
  },
  registerNotification(level, message, ...actions) {
    const notification = {
      level, 
      message, 
      actions, 
      then(resolve) {
        this.resolve = resolve;
        
      }
    }
    this.notifications.push(notification)
    return notification;
  },

}

if (!NotificationsMock.initialized) {
  NotificationsMock.initialize()

  beforeEach(() => {
    NotificationsMock.cleanup()
  })
}