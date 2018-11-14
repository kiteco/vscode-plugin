
window.initStatus = function() {
  let vscode;
  if(typeof acquireVsCodeApi != 'undefined') {
    vscode = window.vscode = acquireVsCodeApi();
  } else {
    vscode = window.vscode;
  }

  const link = document.querySelector('.kite-warning-box .resend-email');
  const box = document.querySelector('.kite-warning-box');

  vscode.postMessage({
    command: 'count',
    metric: 'fulfilled',
    name: 'status_panel',
  })

  if (link) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      link.innerHTML = 'Please wait&hellip;';
      link.style.pointerEvents = 'none';

      vscode.postMessage({
        command: 'resendEmail',
      });
      box.classList.remove('kite-warning-box');
      box.classList.add('kite-info-box');
      box.textContent = link.getAttribute('data-confirmation');
    });
  }
}
