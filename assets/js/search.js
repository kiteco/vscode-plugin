window.initSearch = (inputId, resultsId, viewId) => {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  const view = document.getElementById(viewId);
  let stack = Promise.resolve(); 
  let selectedItem = document.querySelector('li.selected');
  let recording = false;

  initItemContent();

  input.addEventListener('input', () => {
    const text = input.value;

    startRecordMetric();

    if (text.trim() !== '') {
      stack = stack
      .then(() => request('GET', `http://localhost:${window.PORT}/search?text=${text}`))
      .then(res => {
        results.innerHTML = res;
        if (results.childNodes.length > 0) {
          selectNextItem();
        } else {
          view.innerHTML = '';
        }
      }).catch(err => {
        console.log(err.message);
      });
    } else {
      stack = stack.then(() => {
        results.innerHTML = '';
        view.innerHTML = '';
      });
    }
  });

  function startRecordMetric() {
    if (!recording) {
      recording = true;
      window.requestGet('/count?metric=requested&name=active_search');

      setTimeout(() => {
        if (view && view.querySelector('.scroll-wrapper *')) {
          window.requestGet('/count?metric=fulfilled&name=active_search');
        }

        recording = false;
      }, 1000);
    }
  }

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
    scrollTo(item);
  }

  function loadItem(id) {
    view.style.display = '';
    request('GET', `http://localhost:${window.PORT}/view?id=${id}`).then(html => {
      view.innerHTML = html;
      initItemContent();
    });
  }

  function initItemContent() {
    // if (document.querySelector('.sections-wrapper')) {
    //   const sticky = new StickyTitle(
    //     document.querySelectorAll('h4'), 
    //     document.querySelector('.sections-wrapper')
    //   );
    // }
    createJumpTo();
    handleExternalLinks();
    handleCollapsibles();
  }

  function scrollTo(target) {
    const containerBounds = results.getBoundingClientRect();
    const scrollTop = results.scrollTop;
    const targetTop = target.offsetTop;
    const targetBottom = targetTop + target.offsetHeight;

    if (targetTop < scrollTop) {
      results.scrollTop = targetTop;
    } else if (targetBottom > scrollTop + containerBounds.height) {
      results.scrollTop = targetBottom - containerBounds.height;
    }
  }
}
