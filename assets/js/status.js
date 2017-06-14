window.initStatus = function() {
  const link = document.querySelector('.kite-warning-box .resend-email');
  const box = document.querySelector('.kite-warning-box');

  if (link) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      link.innerHTML = 'Please wait&hellip;';
      link.style.pointerEvents = 'none';

      window.requestGet('/status/resendEmail')
      .then(() => {
        box.classList.remove('kite-warning-box');
        box.classList.add('kite-info-box');
        box.textContent = link.getAttribute('data-confirmation');
      })
      .catch(() => {
        box.innerHTML = link.getAttribute('data-failure');
      });
    });
  }
}