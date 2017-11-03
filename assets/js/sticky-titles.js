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

    scrollContainer.addEventListener('scroll', e => {
      this.scroll();
    });

    this.stickies.forEach(sticky => {
      sticky.addEventListener('mousewheel', e => {
        scrollContainer.scrollTop += e.deltaY;
      });
    });

    this.scrollContainer.addEventListener('click', (e) => {
      this.stickies.some(sticky => {
        const bounds = sticky.getBoundingClientRect();
        if (e.pageY >= bounds.top && e.pageY < bounds.bottom) {
          this.scrollTo(sticky.parentNode);
        }
      })
    });

    this.handleCollapsibles();

    window.addEventListener('resize', () => {
      this.measureWidthAndHeight();
    });

    this.scroll();
    this.measureWidthAndHeight();
  }

  handleCollapsibles() {
    [].slice.call(this.scrollContainer.querySelectorAll('.collapsible')).forEach(collapsible => {
      const content = collapsible.querySelector('.section-content');

      let summaryLink = collapsible.querySelector('a[data-action="expand"]') 
      if (!summaryLink) {
        summaryLink = document.createElement('a');
        summaryLink.href = '#';
        summaryLink.dataset.action = 'expand';
        summaryLink.innerHTML = 'show more&hellip;';

        summaryLink.addEventListener('click', e => {
          e.preventDefault();
          if (summaryLink.dataset.action === 'expand') {
            summaryLink.dataset.action = 'collapse';
            summaryLink.innerHTML = 'show less&hellip;';
            collapsible.classList.remove('collapse');
          } else {
            summaryLink.dataset.action = 'expand';
            summaryLink.innerHTML = 'show more&hellip;';
            collapsible.classList.add('collapse');
          }
          this.scroll();
        });
      }

      collapsible.classList.add('collapse');
      if (content.scrollHeight > content.offsetHeight) {
        collapsible.classList.add('overflow');
        collapsible.appendChild(summaryLink);
      } else {
        collapsible.classList.remove('overflow');
        if (summaryLink.parentNode) {
          collapsible.removeChild(summaryLink);
        }
      }
    })


    this.scroll();
  }

  measureWidthAndHeight() {
    if (this.width == null || this.height == null ||
        this.width !== this.scrollContainer.offsetWidth ||
        this.height !== this.scrollContainer.offsetHeight) {
      this.width = this.scrollContainer.offsetWidth;
      this.height = this.scrollContainer.offsetHeight;
      
      this.compactMode = this.titleHeight * this.stickies.length + 200 > this.height;
      this.scrollContainer.classList.toggle('compact', this.compactMode);
      
      requestAnimationFrame(() => this.scroll());
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

    if (this.compactMode) {
      this.stickies.forEach(sticky => sticky.classList.remove('fixed'));
    } else {
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
  }
};
