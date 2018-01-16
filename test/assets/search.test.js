const expect = require('expect.js');
const jsdom = require('mocha-jsdom');
const sinon = require('sinon');
const {click} = require('widjet-test-utils/events');

describe.only('initSearch', () => {
  let form, results, view;

  jsdom();

  beforeEach(() => {
    require('../../assets/js/jump-to');
    require('../../assets/js/external-links');
    require('../../assets/js/collapsible');
    require('../../assets/js/search');

    document.body.innerHTML = `
    <div class="search-form">
      <input type="text" id="text" placeholder="Search identifier…"></input>
      <i class="icon icon-search"></i>
    </div>

    <div id="results"><ul></ul></div>
    <div id="view"></div>
    `;

    window.requestGet = sinon.stub().returns(Promise.resolve());
    window.initSearch('text', 'results', 'view', undefined, ['json']);
  });

  it('', () => {
    
  });
});