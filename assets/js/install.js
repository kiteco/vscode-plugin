window.initDownloadProgress = function initDownloadProgress() {
  const downloadKiteContainer = document.querySelector('.download-kite');
  const progress = document.querySelector('progress');

  const interval = setInterval(() => {
    requestGet('/install/progress')
    .then(ratio => {
      ratio = parseFloat(ratio);
      downloadKiteContainer.classList.toggle('hidden', ratio === -1 || ratio === 1);
      if (ratio !== -1) {
        progress.value = Math.round(ratio * 100);
        if (ratio === 1) { clearInterval(interval); }
      } 
    });
  }, 50);
}

window.submitEvent = function(event) {
  const form = document.querySelector('form');
  const eventInput = form.querySelector('input[name="event"]');
  eventInput.value = event;
  request(form.method, form.action, new FormData(form));
  return false;
}