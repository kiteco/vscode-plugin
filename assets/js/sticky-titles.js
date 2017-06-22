window.StickyTitle = class StickyTitle {
  constructor(stickies, scrollContainer) {
    this.scrollContainer = scrollContainer;
    this.titleHeight = 40;

    this.stickies = [].slice.call(stickies).map(title => {
      const sticky = document.createElement('div');
      sticky.className = 'sticky';
      sticky.innerHTML = title.innerHTML;
      title.innerHTML = '';
      title.appendChild(sticky);
      sticky.parentNode.style.height = this.titleHeight + 'px';
      sticky.style.width = '100%'; //scrollContainer.offsetWidth + 'px';
      return sticky;
    });

    this.summaryLink = document.createElement('a');
    this.summaryLink.href = '#';
    this.summaryLink.dataset.action = 'expand';
    this.summaryLink.innerHTML = 'show more&hellip;';

    scrollContainer.addEventListener('scroll', e => {
      this.scroll();
    });

    this.summaryLink.addEventListener('click', e => {
      e.preventDefault();
      const summary = this.scrollContainer.querySelector('.summary');
      if (this.summaryLink.dataset.action === 'expand') {
        this.summaryLink.dataset.action = 'collapse';
        this.summaryLink.innerHTML = 'show less&hellip;';
        summary.classList.remove('collapse');
      } else {
        this.summaryLink.dataset.action = 'expand';
        this.summaryLink.innerHTML = 'show more&hellip;';
        summary.classList.add('collapse');
      }
      this.scroll();
    });

    this.scrollContainer.addEventListener('click', (e) => {
      this.stickies.some(sticky => {
        const bounds = sticky.getBoundingClientRect();
        if (e.pageY >= bounds.top && e.pageY < bounds.bottom) {
          this.scrollTo(sticky.parentNode);
        }
      })
    });

    this.collapsible = true;
    const summary = this.scrollContainer.querySelector('.summary');
    summary.classList.add('collapsible');
    this.collapseSummary();

    window.addEventListener('resize', () => {
      this.measureWidthAndHeight();
    });

    this.scroll();
    this.measureWidthAndHeight();
  }

  collapseSummary() {
    const summary = this.scrollContainer.querySelector('.summary');

    if (this.collapsible) {
      const description = summary.querySelector('.description');

      summary.classList.add('collapse');
      if (description.scrollHeight > description.offsetHeight) {
        summary.classList.add('overflow');
        summary.appendChild(this.summaryLink);
      } else {
        summary.classList.remove('overflow');
        if (this.summaryLink.parentNode) {
          summary.removeChild(this.summaryLink);
        }
      }
    } else {
      summary.classList.remove('collapse');
      summary.classList.remove('overflow');
    }

    this.scroll();
  }

  measureWidthAndHeight() {
    if (this.width == null || this.height == null ||
        this.width !== this.scrollContainer.offsetWidth ||
        this.height !== this.scrollContainer.offsetHeight) {
      requestAnimationFrame(() => this.scroll());
      this.width = this.scrollContainer.offsetWidth;
      this.height = this.scrollContainer.offsetHeight;
    }
  }

  dispose() {
    this.subscriptions.dispose();
    this.stickies = null;
    this.scrollContainer = null;
  }

  scrollTo(target) {
    const containerBounds = this.scrollContainer.getBoundingClientRect();
    const scrollTop = this.scrollContainer.scrollTop;
    const top = target.getBoundingClientRect().top + scrollTop - containerBounds.top;

    const offset = this.stickies.reduce((memo, sticky) => {
      const parentBounds = sticky.parentNode.getBoundingClientRect();
      const parentTop = parentBounds.top + scrollTop - containerBounds.top;

      return parentTop < top ? memo + sticky.offsetHeight : memo;
    }, 0);

    this.scrollContainer.scrollTop = top - offset;
  }

  scroll() {
    if (!this.scrollContainer) { return; }
    const containerBounds = this.scrollContainer.getBoundingClientRect();
    const scrollTop = this.scrollContainer.scrollTop + containerBounds.top;
    const scrollBottom = scrollTop + containerBounds.height;

    let refTop = scrollTop;
    let refBottom = scrollBottom;

    let stickies = this.stickies.slice();

    stickies = stickies.filter((sticky, i) => {
      const parentBounds = sticky.parentNode.getBoundingClientRect();
      const parentTop = parentBounds.top + scrollTop - containerBounds.top;

      if (parentTop < refTop) {
        sticky.classList.add('fixed');
        sticky.style.top = (i * this.titleHeight) + 'px';
        refTop += this.titleHeight;
        return false;
      }
      return true;
    });

    stickies = stickies.reverse().filter((sticky, i) => {
      const parentBounds = sticky.parentNode.getBoundingClientRect();
      const parentBottom = parentBounds.bottom + scrollTop - containerBounds.top;

      if (parentBottom > refBottom) {
        sticky.classList.add('fixed');
        sticky.style.top = (containerBounds.height - ((i + 1) * this.titleHeight)) + 'px';

        refBottom -= this.titleHeight;
        return false;
      }

      return true;
    });

    stickies.forEach(sticky => sticky.classList.remove('fixed'));
  }
};
