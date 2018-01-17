window.initSearch = (inputId, resultsId, viewId, searchHistory, gettingStarted, historyTimeoutDuration = 1000) => {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  const resultsList = results.querySelector('ul');
  const view = document.getElementById(viewId);
  let stack = Promise.resolve(); 
  let selectedItem = document.querySelector('li.selected');
  let recording = false;
  let historyTimeout;

  input.focus();
  
  initItemContent();
  
  input.addEventListener('input', () => {
    clearTimeout(historyTimeout);
    const text = input.value;
    
    doSearch(text);
  });

  document.body.addEventListener('click', (e) => {
    if (e.target.nodeName === 'LI') {
      if (e.target.hasAttribute('data-id')) {
        input.value = e.target.textContent.trim();
        selectItem(e.target);
      } else if (e.target.hasAttribute('data-search')) {
        input.value = e.target.getAttribute('data-search');
        doSearch(e.target.getAttribute('data-search'));
      }
    }
  });

  document.body.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      selectPreviousItem();
    } else if (e.key === 'ArrowDown') {
      selectNextItem();
    }
  });

  if (!document.querySelector('li')) {
    clearSearch();
  }

  function doSearch(text) {
    startRecordMetric();
    results.classList.remove('has-results');

    if (text.trim() !== '') {
      stack = stack
      .then(() => window.requestGet(`/search?text=${text}`))
      .then(res => {
        resultsList.innerHTML = res;
        if (resultsList.childNodes.length > 0) {
          return selectNextItem();
        } else {
          resultsList.innerHTML = '<p class="no-results">No results available</p>'
          view.innerHTML = '';
        }
        results.classList.toggle('has-results', resultsList.scrollHeight > resultsList.offsetHeight)
      }).catch(err => {
        console.log(err.message, err.stack);
      });
    } else {
      stack = stack.then(() => {
        clearSearch();
      });
    }
  }
  
  function clearSearch() {
    resultsList.innerHTML = '<p class="grim">Type any identifier above to search docs, popular patterns, signatures and more.</p>';
    view.innerHTML = `
    <h4>${searchHistory && searchHistory.length ? 'Search History' : 'Examples to get you started'}</h4>
    <ul class="history">${
      ((searchHistory && searchHistory.length) ? searchHistory : gettingStarted)
      .map(i => `<li data-search="${i}">${i}</li>`)
      .join('')
    }</ul>`;
  }
  
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

  function selectNextItem() {
    if (resultsList.childNodes.length === 0) { return; }

    if (selectedItem && selectedItem.nextSibling) {
      return selectItem(selectedItem.nextSibling);
    } else {
      return selectItem(resultsList.firstChild);
    }
  }

  function selectPreviousItem() {
    if (resultsList.childNodes.length === 0) { return; }

    if (selectedItem && selectedItem.previousSibling) {
      return selectItem(selectedItem.previousSibling);
    } else {
      return selectItem(resultsList.lastChild);
    }
  }

  function selectItem(item) {
    selectedItem && selectedItem.classList.remove('selected');
    selectedItem = item;
    selectedItem.classList.add('selected');
    return loadItem(item.getAttribute('data-id'))
    .then(() => {
      scrollTo(item);
    });
  }

  function loadItem(id) {
    clearTimeout(historyTimeout);

    view.style.display = '';
    return window.requestGet(`/view?id=${id}`).then(html => {
      if (html.trim() !== '') {
        view.innerHTML = html;
        initItemContent();

        historyTimeout = setTimeout(() => {
          window.requestPost('/search/stack', {q: input.value}).then(data => {
            searchHistory = JSON.parse(data);
          });
        }, historyTimeoutDuration);
      }
    });
  }

  function initItemContent() {
    // if (document.querySelector('.sections-wrapper')) {
    //   const sticky = new StickyTitle(
    //     document.querySelectorAll('h4'), 
    //     document.querySelector('.sections-wrapper')
    //   );
    // }
    window.createJumpTo();
    window.handleExternalLinks();
    window.handleCollapsibles();
  }

  function scrollTo(target) {
    const containerBounds = resultsList.getBoundingClientRect();
    const scrollTop = resultsList.scrollTop;
    const targetTop = target.offsetTop;
    const targetBottom = targetTop + target.offsetHeight;

    if (targetTop < scrollTop) {
      resultsList.scrollTop = targetTop;
    } else if (targetBottom > scrollTop + containerBounds.height) {
      resultsList.scrollTop = targetBottom - containerBounds.height;
    }
  }
}
