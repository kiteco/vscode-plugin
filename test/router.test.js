
const fs = require('fs');
const vscode = require('vscode');
const jsdom = require('mocha-jsdom');
const expect = require('expect.js');
const KiteRouter = require('../src/router');
const {fixtureURI, withRoutes, withKiteWhitelistedPaths, fakeResponse, Kite} = require('./helpers');

const textContent = selector => document.querySelector(selector).textContent.trim().replace(/\s+/g, ' ')

describe.only('router', () => {
  jsdom();

  let router;
  let source;

  withKiteWhitelistedPaths([__dirname], () => {
    beforeEach(() => {
      router = new KiteRouter();
    })

    describe('member route', () => {
      withRoutes([
        [
          o => /\/api\/editor\/symbol\//.test(o.path),
          o => fakeResponse(200, fs.readFileSync(fixtureURI('module-os.json').toString()))
        ]
      ])

      beforeEach(() => {
        source = require(fixtureURI('module-os.json'));
        router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://member/python;json'));
        
        return router.provideTextDocumentContent().then(html => {
          document.body.innerHTML = html;
          console.log(html);
        });
      });

      it('renders a symbol header', () => {
        expect(textContent('.expand-header')).to.eql('os module')
      });
      
      it('renders a list of the top 2 modules members', () => {
        const section = document.querySelector('section.top-members');
        expect(section.querySelectorAll('li').length).to.eql(2);

        const link = section.querySelector('.more-members')
      
        expect(link).not.to.be(null);
        expect(link.href).to.eql('command:kite.navigate?%22members-list/python;os%22')
      });

      it('renders a docs section', () => {
        const section = document.querySelector('.summary');
        const summary = section.querySelector('.description');
        
        expect(section).not.to.be(null);
        expect(summary).not.to.be(null);
        
        expect(section.classList.contains('collapsible')).to.be(true);
        expect(section.classList.contains('collapse')).to.be(true);
        expect(summary.innerHTML).to.eql(source.report.description_html);
      });
    });
  });
});