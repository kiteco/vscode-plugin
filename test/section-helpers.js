const expect = require('expect.js');
const {stripBody, asArray} = require('../src/html-utils');

const textContent = node => node.textContent.trim().replace(/\s+/g, ' ');
const selectorContent = selector => textContent(document.querySelector(selector));

module.exports.textContent = textContent;
module.exports.selectorContent = selectorContent;

module.exports.hasHeaderSection = (content) => {
  it('renders a symbol header', () => {
    expect(selectorContent('.expand-header')).to.eql(content);
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

module.exports.hasExamplesSection = (count, id, examples) => {
  it(`renders a list of ${count} examples`, () => {
    const section = document.querySelector('section.examples');
    const lis =  section.querySelectorAll('li');
    expect(lis.length).to.eql(count);

    asArray(lis).forEach((li, i) => {
      expect(textContent(li)).to.eql(examples[i].title);
    });

    if (examples.length > count) {
      const link = section.querySelector('.more-examples');
  
      expect(link).not.to.be(null);
      expect(link.href).to.eql(`command:kite.navigate?%22examples-list/${id}%22`);
    }
  });
}

module.exports.hasLinksSection = (count, id, links) => {
  it(`renders a list of ${count} links`, () => {
    const section = document.querySelector('section.links');
    const lis = section.querySelectorAll('li');
    expect(lis.length).to.eql(count);

    asArray(lis).forEach((li, i) => {
      expect(textContent(li)).to.eql(links[i].title);
    });

    if (links.length > count) {
      const link = section.querySelector('.more-links');
  
      expect(link).not.to.be(null);
      expect(link.href).to.eql(`command:kite.navigate?%22links-list/${id}%22`);
    }
  });
}