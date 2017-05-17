window.handleExternalLinks = function handleExternalLinks() {
  [].slice.call(document.querySelectorAll('a.external_link')).forEach(a => {
    a.href = a.getAttribute('href').replace(/^#/, '');
  });
}