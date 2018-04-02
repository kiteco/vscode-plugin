const expect = require('expect.js');
const jsdom = require('mocha-jsdom');
const sinon = require('sinon');
const {click} = require('widjet-test-utils/events');

describe('createJumpTo', () => {
  jsdom();

  beforeEach(() => {
    require('../../assets/js/jump-to');

    sinon.stub(window, 'jumpTo');
  });

  afterEach(() => {
    window.jumpTo.restore();
  })

  describe('when there is no examples nor docs', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <footer>
          <div class="actions"></div>
        </footer>
      `;

      window.createJumpTo();
    });

    it('adds nothing to the footer actions', () => {
      expect(document.querySelector('footer .actions').children.length).to.eql(0);
    });
  });

  describe('when there is no examples but some docs', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="summary">Some docs</div>

        <footer>
          <div class="actions"></div>
        </footer>
      `;

      window.createJumpTo();
    });

    it('creates a link in the footer to jump to the docs', () => {
      const actions = document.querySelector('footer .actions');
      expect(actions.textContent).to.eql('Jump to  Description');

      const link = actions.querySelector('a');
      expect(link.getAttribute('onclick')).to.eql("jumpTo('.summary'); return false;");
    });
  });

  describe('when there is no docs but some generic examples', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="examples">Some examples</div>

        <footer>
          <div class="actions"></div>
        </footer>
      `;

      window.createJumpTo();
    });

    it('creates a link in the footer to jump to the examples', () => {
      const actions = document.querySelector('footer .actions');
      expect(actions.textContent).to.eql('Jump to  How to');

      const link = actions.querySelector('a');
      expect(link.getAttribute('onclick')).to.eql("jumpTo('.examples'); return false;");
    });
  });

  describe('when there is no docs but some examples from local code', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="examples-from-your-code">Some examples</div>

        <footer>
          <div class="actions"></div>
        </footer>
      `;

      window.createJumpTo();
    });

    it('creates a link in the footer to jump to the examples', () => {
      const actions = document.querySelector('footer .actions');
      expect(actions.textContent).to.eql('Jump to  How to');

      const link = actions.querySelector('a');
      expect(link.getAttribute('onclick')).to.eql("jumpTo('.examples-from-your-code'); return false;");
    });
  });

  describe('when there is no docs but some examples both generic and from local code', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="examples-from-your-code">Some examples</div>
        <div class="examples">Some examples</div>

        <footer>
          <div class="actions"></div>
        </footer>
      `;

      window.createJumpTo();
    });

    it('creates a link in the footer to jump to the examples from local code', () => {
      const actions = document.querySelector('footer .actions');
      expect(actions.textContent).to.eql('Jump to  How to');

      const link = actions.querySelector('a');
      expect(link.getAttribute('onclick')).to.eql("jumpTo('.examples-from-your-code'); return false;");
    });
  });

  describe('when there are docs and some examples both generic and from local code', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="examples-from-your-code">Some examples</div>
        <div class="examples">Some examples</div>
        <div class="summary">Some docs</div>

        <footer>
          <div class="actions"></div>
        </footer>
      `;

      window.createJumpTo();
    });

    it('creates a link in the footer to jump to the examples and docs', () => {
      const actions = document.querySelector('footer .actions');
      expect(actions.textContent).to.eql('Jump to  Description  How to');

      const link1 = actions.querySelector('a');
      expect(link1.getAttribute('onclick')).to.eql("jumpTo('.summary'); return false;");

      const link2 = actions.querySelector('a:last-child');
      expect(link2.getAttribute('onclick')).to.eql("jumpTo('.examples-from-your-code'); return false;");
    });
  });
});
