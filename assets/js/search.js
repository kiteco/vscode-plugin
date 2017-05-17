window.initSearch = (inputId, resultsId, viewId) => {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  const view = document.getElementById(viewId);
  let stack = Promise.resolve(); 
  let selectedItem = document.querySelector('li.selected');

  input.addEventListener('input', () => {
    const text = input.value;

    if (text.trim() !== '') {
      stack = stack
      .then(() => request('GET', `http://localhost:${window.PORT}/search?text=${text}`))
      .then(res => {
        results.innerHTML = res;
        selectNextItem();
      }).catch(err => {
        console.log(err);
      });
    } else {
      stack = stack.then(() => {
        results.innerHTML = '';
        view.innerHTML = '';
      });
    }
  });

  document.body.addEventListener('click', (e) => {
    if (e.target.nodeName === 'LI' && e.target.hasAttribute('data-id')) {
      selectItem(e.target);
    }
  });
  document.body.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      selectPreviousItem();
    } else if (e.key === 'ArrowDown') {
      selectNextItem();
    }
  })

  function selectNextItem() {
    if (results.childNodes.length === 0) { return; }

    if (selectedItem && selectedItem.nextSibling) {
      selectItem(selectedItem.nextSibling);
    } else {
      selectItem(results.firstChild);
    }
  }

  function selectPreviousItem() {
    if (results.childNodes.length === 0) { return; }

    if (selectedItem && selectedItem.previousSibling) {
      selectItem(selectedItem.previousSibling);
    } else {
      selectItem(results.lastChild);
    }
  }

  function selectItem(item) {
    selectedItem && selectedItem.classList.remove('selected');
    selectedItem = item;
    selectedItem.classList.add('selected');
    loadItem(item.getAttribute('data-id'));
  }

  function loadItem(id) {
    view.style.display = '';
    request('GET', `http://localhost:${window.PORT}/view?id=${id}`).then(html => {
      view.innerHTML = html
    });
  }
}
