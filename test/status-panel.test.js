'use strict';

const expect = require('expect.js');
const vscode = require('vscode');
const KiteStatus = require('../src/status');
const {kite: Kite} = require('../src/kite');
const {fixtureURI} = require('./helpers');

const {withKite, withKiteRoutes} = require('kite-api/test/helpers/kite');
const {fakeResponse} = require('kite-api/test/helpers/http');

const dot = '•';

let status;
const loadStatus = () => {
  beforeEach(() => {
    return status.provideTextDocumentContent()
          .then(html => document.body.innerHTML = html)
          .catch(err => console.log(err));
  });
};

describe('status panel', () => {
  before(function () {
    this.jsdom = require('jsdom-global')();
  });
  
  after(function () {
    this.jsdom();
  });
  
  beforeEach(() => {
    Kite.supportedLanguages = []
    status = new KiteStatus(Kite);
  });

  withKite({installed: false}, () => {
    loadStatus();

    it('shows a warning message stating kite is not installed', () => {
      const msg = document.querySelector('.status .text-danger');
      expect(msg.textContent).to.eql(`Kite engine is not installed ${dot}`);
    });

    it('shows a link to download kite', () => {
      const link = document.querySelector('.status a');

      expect(link.href).to.eql('https://kite.com/download')
      expect(link.textContent).to.eql('Install now')
    });

    it('does not render the account information', () => {
      expect(document.querySelector('.split-line')).to.be(null);
    });
  });

  withKite({running: false}, () => {
    loadStatus();
    
    it('shows a warning message stating kite is not running', () => {
      const msg = document.querySelector('.status .text-danger');
      expect(msg.textContent).to.eql(`Kite engine is not running ${dot}`);
    });

    it('shows a link to start kite', () => {
      const link = document.querySelector('.status a');

      expect(link.textContent).to.eql('Launch now')
    });

    it('does not render the account information', () => {
      expect(document.querySelector('.split-line')).to.be(null);
    });
  })

  withKite({reachable: false}, () => {
    loadStatus();
    
    it('shows a warning message stating kite is not reachable', () => {
      const msg = document.querySelector('.status .text-danger');
      expect(msg.textContent).to.eql(`Kite engine is not reachable`);
    });
  
    it('does not render the account information', () => {
      expect(document.querySelector('.split-line')).to.be(null);
    });
  });
  
  withKite({reachable: true}, () => {
    loadStatus();
    
    it('shows a warning message stating the use is not logged in', () => {
      const msg = document.querySelector('.status .text-danger');
      expect(msg.textContent).to.eql(`Kite engine is not logged in ${dot}`);
    });
    
    it('shows a login action', () => {
      const link = document.querySelector('.status a');
      
      expect(link.textContent).to.eql('Login now')
    });
    
    it('does not render the account information', () => {
      expect(document.querySelector('.split-line')).to.be(null);
    });
  });  
  
  withKite({reachable: true}, () => {
    describe('with no editor open', () => {
      loadStatus();
      
      it('says that kite status will be available by opening a file', () => {
        const msg = document.querySelector('.status div');
        expect(msg.textContent).to.eql(`Open a supported file to see Kite's status ${dot}`);
      });
    })

    describe('with a non-supported editor open', () => {
      beforeEach(() => {
        Kite.supportedLanguages = ['python'];
        const uri = vscode.Uri.file(fixtureURI('hello.json'));

        return vscode.workspace.openTextDocument(uri)
      });

      loadStatus();
      
      it('says that kite status will be available by opening a file', () => {
        const msg = document.querySelector('.status div');
        expect(msg.textContent).to.eql(`Open a supported file to see Kite's status ${dot}`);
      });
    });

    describe('header', () => {
      loadStatus();
  
      it('displays a pro icon', () => {
        expect(document.querySelector('.split-line .left svg')).not.to.be(null);
      });
  
      it('displays a link to the user account', () => {
        const link = document.querySelector('.split-line .right a');
        expect(link).not.to.be(null);
        expect(link.textContent).to.eql('Account');
        expect(link.href).to.eql('http://localhost:46624/clientapi/desktoplogin?d=/settings/acccount');
      });
    })
  });
});