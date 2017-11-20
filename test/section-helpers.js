const expect = require('expect.js');
const {stripBody} = require('../src/html-utils');

const textContent = selector => document.querySelector(selector).textContent.trim().replace(/\s+/g, ' ');

module.exports.textContent = textContent;

module.exports.hasHeaderSection = (content) => {
  it('renders a symbol header', () => {
    expect(textContent('.expand-header')).to.eql(content);
  });
}

module.exports.hasMembersSection = (members, id) => {
  it(`renders a list of the top ${members} modules members`, () => {
    const section = document.querySelector('section.top-members');
    expect(section.querySelectorAll('li').length).to.eql(members);

    const link = section.querySelector('.more-members')

    expect(link).not.to.be(null);
    expect(link.href).to.eql(`command:kite.navigate?%22members-list/${id}%22`);
  });
}

module.exports.hasDocsSection = (docs) => {
  it('renders a docs section', () => {
    const section = document.querySelector('.summary');
    const summary = section.querySelector('.description');
    
    expect(section).not.to.be(null);
    expect(summary).not.to.be(null);
    
    expect(section.classList.contains('collapsible')).to.be(true);
    expect(section.classList.contains('collapse')).to.be(true);
    expect(summary.innerHTML).to.eql(stripBody(docs).replace(/&#39;/g, "'"));
  });
}

module.exports.hasExamplesSection = (examples, id) => {
  it(`renders a list of ${examples} examples`, () => {
    const section = document.querySelector('section.examples');
    expect(section.querySelectorAll('li').length).to.eql(examples);

    const link = section.querySelector('.more-examples')

    expect(link).not.to.be(null);
    expect(link.href).to.eql(`command:kite.navigate?%22examples-list/${id}%22`);
  });
}