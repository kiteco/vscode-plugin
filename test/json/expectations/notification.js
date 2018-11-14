'use strict';

const expect = require('expect.js')
const vscode = require('vscode');
const {substituteFromContext, buildContext, itForExpectation, NotificationsMock} = require('../utils');
const {waitsFor} = require('../../helpers')

module.exports = ({expectation, not, root}) => {
  beforeEach(() => {
    const spy = vscode.window[NotificationsMock.LEVELS[expectation.properties.level]]
    const promise = waitsFor(`${expectation.properties.level} notification`, () => {
      return NotificationsMock.newNotification();
    }, 100)

    if(not) {
      return promise.then(() => {
        throw new Error(`no ${expectation.properties.level} notification, but some were found`)
      }, () => {})
    } else {
      return promise
    }
  });

  const block = () => {
    if(!not) {
      expect(NotificationsMock.lastNotification.level).to.eql(expectation.properties.level)
  
      if(expectation.properties.message) {
        const message = substituteFromContext(expectation.properties.message, buildContext(root))
  
        expect(NotificationsMock.lastNotification.message).to.eql(message);
      }
    }
  }

  itForExpectation(expectation, block);
}
