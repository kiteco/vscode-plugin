const iconDocs = '<svg viewBox="0 0 17.22 17"><g id="Layer_2" data-name="Layer 2"><g id="Layer_1-2" data-name="Layer 1"><path id="editor-books-library-collection-glyph" d="M0,5.9V16.39c0,.31.36.55.8.55H3.23c.44,0,.8-.24.8-.55V5.9c0-.31-.36-.55-.8-.55H.8C.36,5.35,0,5.59,0,5.9Zm4.83-5V16.14a.81.81,0,0,0,.8.81H8.05a.8.8,0,0,0,.8-.81V.86a.81.81,0,0,0-.8-.81H5.62A.8.8,0,0,0,4.83.86Zm4.53.78,4,14.76a.81.81,0,0,0,1,.57l2.35-.63a.8.8,0,0,0,.56-1L13.24.6a.81.81,0,0,0-1-.57L9.91.66A.8.8,0,0,0,9.35,1.64Z"/></g></g></svg>';

const iconExamples = '<svg viewBox="0 0 22.96 17.23"><g id="Layer_2" data-name="Layer 2"><g id="Layer_1-2" data-name="Layer 1"><path d="M7.18,14.12l-.63.63a.39.39,0,0,1-.58,0L.13,8.9a.39.39,0,0,1,0-.58L6,2.48a.39.39,0,0,1,.58,0l.63.63a.39.39,0,0,1,0,.58L2.25,8.62l4.93,4.93a.39.39,0,0,1,0,.58ZM14.59.73,9.91,16.93a.41.41,0,0,1-.19.24.35.35,0,0,1-.29,0L8.65,17a.41.41,0,0,1-.24-.19.38.38,0,0,1,0-.31L13.05.3a.41.41,0,0,1,.19-.24.35.35,0,0,1,.29,0l.78.21a.41.41,0,0,1,.24.19A.38.38,0,0,1,14.59.73ZM22.84,8.9,17,14.75a.39.39,0,0,1-.58,0l-.63-.63a.39.39,0,0,1,0-.58l4.93-4.93L15.79,3.68a.39.39,0,0,1,0-.58l.63-.63a.39.39,0,0,1,.58,0l5.85,5.85a.39.39,0,0,1,0,.58Z"/></g></g></svg>';

window.jumpTo = function jumpTo (targetCls) {
  const target = document.querySelector(targetCls);
  const container = document.querySelector('.sections-wrapper');
  const containerBounds = container.getBoundingClientRect();
  const scrollTop = container.scrollTop;
  const top = target.offsetTop;

  const offset = 0;
  container.scrollTop = top - offset;
}

window.createJumpTo = function createJumpTo () {
  const examplesSection = document.querySelector('.examples-from-your-code') || document.querySelector('.examples');
  const docsSection = document.querySelector('.summary');

  const links = [];

  if (docsSection) {
    links.push(`<a href="#" class="docs-button" onclick="jumpTo('.summary'); return false;">${iconDocs} <span>Docs</span></a>`)  
  }
  
  if (examplesSection) {
    links.push(`<a href="#" class="examples-button" onclick="jumpTo('.${examplesSection.className}'); return false;">${iconExamples} <span>Examples</span></a>`)  
  }

  if (links.length > 0) {
    const actions = document.querySelector('footer .actions');
    actions.innerHTML = `Jump to ${links.join(' ')}`
  }
};