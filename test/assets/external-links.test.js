const expect = require('expect.js');
const jsdom = require('mocha-jsdom');
const sinon = require('sinon');

describe('handleExternalLinks', () => {
  jsdom();

  beforeEach(() => {
    require('../../assets/js/external-links');

    document.body.innerHTML = `<a class="external_link" href="#foo">Foo</a>`;
  });
  it('removes # in href', () => {
    window.handleExternalLinks();

    expect(document.querySelector('a').href).to.eql('foo');
  });
});