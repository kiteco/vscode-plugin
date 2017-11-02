window.handleCollapsibles = function() {
  [].slice.call(document.querySelectorAll('.collapsible')).forEach(collapsible => {
    const content = collapsible.querySelector('.section-content');

    let expandLink = collapsible.querySelector('a[data-action="expand"]') 
    if (!expandLink) {
      expandLink = document.createElement('a');
      expandLink.href = '#';
      expandLink.dataset.action = 'expand';
      expandLink.innerHTML = 'show more&hellip;';

      expandLink.addEventListener('click', e => {
        e.preventDefault();
        if (expandLink.dataset.action === 'expand') {
          expandLink.dataset.action = 'collapse';
          expandLink.innerHTML = 'show less&hellip;';
          collapsible.classList.remove('collapse');
        } else {
          expandLink.dataset.action = 'expand';
          expandLink.innerHTML = 'show more&hellip;';
          collapsible.classList.add('collapse');
        }
        this.scroll();
      });
    }

    collapsible.classList.add('collapse');
    if (content.scrollHeight > content.offsetHeight) {
      collapsible.classList.add('overflow');
      collapsible.appendChild(expandLink);
    } else {
      collapsible.classList.remove('overflow');
      if (expandLink.parentNode) {
        collapsible.removeChild(expandLink);
      }
    }
  });
}