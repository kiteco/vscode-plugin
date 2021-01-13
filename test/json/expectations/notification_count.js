'use strict';

const expect = require('chai').expect;
const { itForExpectation, NotificationsMock } = require('../utils');

module.exports = ({ expectation, not }) => {
  const block = () => {
    if(not) {
      expect(NotificationsMock.notificationsForLevel(expectation.properties.level).length).not.to.eql(expectation.properties.count);
    } else {
      expect(NotificationsMock.notificationsForLevel(expectation.properties.level).length).to.eql(expectation.properties.count);
    }
  };

  itForExpectation(expectation, block);
};

