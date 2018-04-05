const expect = require('expect.js');
const sinon = require('sinon');
const {stripBody, stripTBody, asArray, handleInternalLinks} = require('../src/html-utils');
const Plan = require('../src/plan');

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
    const section = document.querySelector('section.popular-members');
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
    expect(testInternalLinks(stripTBody(summary.innerHTML)))
    .to.eql(handleInternalLinks(stripBody(docs)).replace(/&#39;/g, "'"));
  });
}

function testInternalLinks(html) {
  return html
  .replace(/<a class="internal_link" href="([^"]+)"/g, (m, r) => `<a class="internal_link" href='${r.replace(/&quot;/g, '"')}'`)
  .replace(/<a href="([^"]+)" class="internal_link"/g,
    (m, r) => `<a href='${r.replace(/&quot;/g, '"')}' class="internal_link"`);
}

module.exports.hasExamplesSection = (count, id, examples) => {
  it(`renders a list of ${count} examples`, () => {
    const section = document.querySelector('section.how-to');
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

module.exports.hasArgumentsSection = (functionDetails, language) => {
  const args = functionDetails.parameters;

  it('renders a list of the function arguments', () => {
    const section = document.querySelector('section.parameters');
    const dts = section.querySelectorAll('dt');

    let argsCount = args.length;

    switch(language) {
      case 'python':
        if(functionDetails.language_details.python.kwarg) { argsCount += 1 }
        break;
      case 'javascript':
        if(functionDetails.language_details.javascript.rest) { argsCount += 1 }
        break;
    }

    expect(dts.length).to.eql(argsCount)
  });

  switch(language) {
    case 'python':
      if(functionDetails.language_details.python.kwarg) {
        it('renders a list of the function kwargs', () => {
          const section = document.querySelector('section.kwargs');
          const dts = section.querySelectorAll('dt');

          expect(section.classList.contains('collapsible'));
          expect(section.classList.contains('collapse'));
          expect(dts.length).to.eql(functionDetails.language_details.python.kwarg_parameters.length);
        })
      }
      break;
  }
}

module.exports.hasUsagesSection = (usages) => {
  describe('with a pro plan', () => {
    let stub;
    before(() => {
      stub = sinon.stub(Plan, 'can').returns(true);
    });

    after(() => stub.restore());

    it('renders the usages section with its content', () => {
      const section = document.querySelector('section.examples-from-your-code');

    });
  });

  describe('with a community plan', () => {
    let stubCan, stubTrial;

    before(() => {
      stubCan = sinon.stub(Plan, 'can').returns(false);
    });

    after(() => stubCan.restore());

    describe('with a started trial', () => {
      before(() => {
        stubTrial = sinon.stub(Plan, 'hasStartedTrial').returns(true);
      })

      after(() => stubTrial.restore());

      it('renders a message to upgrade plan', () => {
        const section = document.querySelector('section.examples-from-your-code');

        expect(textContent(section.querySelector('.section-content')))
        .to.eql(`To see ${usages.length} usages, upgrade to Kite Pro, or get Kite Pro for free`);

        const links = section.querySelectorAll('a');

        expect(links[0].href).to.eql('command:kite.web-url?%22http://localhost:46624/redirect/pro%22');
        expect(links[1].href).to.eql('command:kite.web-url?%22http://localhost:46624/redirect/invite%22');
      });
    });

    describe('with no started trial', () => {
      before(() => {
        stubTrial = sinon.stub(Plan, 'hasStartedTrial').returns(false);
      })

      after(() => stubTrial.restore());

      it('renders a message to upgrade plan', () => {
        const section = document.querySelector('section.examples-from-your-code');

        expect(textContent(section.querySelector('.section-content')))
        .to.eql(`To see ${usages.length} usages, start your Kite Pro trial at any time`);

        const links = section.querySelectorAll('a');

        expect(links[0].href).to.eql('command:kite.web-url?%22http://localhost:46624/redirect/trial%22');
      });
    });
  });
}
