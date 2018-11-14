const sinon = require('sinon');
const expect = require('expect.js');
const {click} = require('widjet-test-utils/events');

describe('initStatus', () => {
  let infoBox, link;

  before(function () {
    this.jsdom = require('jsdom-global')()
  })

  after(function () {
    this.jsdom()
  })

  beforeEach(() => {
    require('../../assets/js/status');

    document.body.innerHTML = `
    <div class="kite-warning-box">
      <a href="#"
         class="resend-email"
         data-confirmation="confirmation text"
         data-failure="failure text">test</a>
    </div>
    `;

    infoBox = document.querySelector('.kite-warning-box');
    link = infoBox.querySelector('.resend-email');
    window.vscode = {
      postMessage: sinon.stub()
    }
    window.initStatus();
  })

  it('sends a status request fulfilled metric', () => {
    expect(window.vscode.postMessage.calledWith({
      command: 'count',
      name: 'status_panel',
      metric: 'fulfilled',
    })).to.be.ok()
  });

  describe('clicking on the resend email link', () => {
    describe('when the resendEmail request succeeds', () => {
      it('changes the info box class and message', () => {
        click(link);

        return new Promise((resolve) => {
          setTimeout(() => {
            expect(window.vscode.postMessage.calledWith({
              command: 'resendEmail',
            })).to.be.ok()
            expect(infoBox.classList.contains('kite-warning-box')).not.to.be.ok()
            expect(infoBox.classList.contains('kite-info-box')).to.be.ok()
            expect(infoBox.textContent).to.eql(link.getAttribute('data-confirmation'))
            resolve();
          }, 10)
        })
      });
    });
  });
});
