const expect = require('expect.js');
const jsdom = require('mocha-jsdom');
const sinon = require('sinon');
const {click} = require('widjet-test-utils/events');

describe('initStatus', () => {
  let infoBox, link;

  jsdom();

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
    window.requestGet = sinon.stub().returns(Promise.resolve());
    window.initStatus();
  })

  it('sends a status request fulfilled metric', () => {
    expect(window.requestGet.calledWith('/count?metric=fulfilled&name=status_panel')).to.be.ok()
  });
  
  describe('clicking on the resend email link', () => {
    describe('when the resendEmail request succeeds', () => {
      it('changes the info box class and message', () => {
        click(link);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            expect(window.requestGet.calledWith('/status/resendEmail')).to.be.ok()
            expect(infoBox.classList.contains('kite-warning-box')).not.to.be.ok()
            expect(infoBox.classList.contains('kite-info-box')).to.be.ok()
            expect(infoBox.textContent).to.eql(link.getAttribute('data-confirmation'))
            resolve();
          }, 10)
        })
      });
    });

    describe('when the request fails', () => {
      beforeEach(() => {
        window.requestGet = sinon.stub().returns(Promise.reject());
      });

      it('changes the info box message', () => {
        click(link);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            expect(window.requestGet.calledWith('/status/resendEmail')).to.be.ok()
            expect(infoBox.textContent).to.eql(link.getAttribute('data-failure'))
            resolve();
          }, 10)
        })
      });
    })
  });
});