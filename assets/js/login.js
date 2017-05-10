window.initLogin = function initLogin() {
  const form = document.querySelector('form.login-form');
  const success = document.querySelector('.text-success');
  const status = form.querySelector('.form-status');
  const emailInput = form.querySelector('[name="email"]');
  const resetLink = form.querySelector('.reset-password');
  const resetBtn = form.querySelector('.send-link');

  emailInput.addEventListener('input', () => {
    const url = `https://alpha.kite.com/account/resetPassword/request?email=${emailInput.value}`;

    resetLink.href = url;
    resetBtn.href = url;
  });

  form.addEventListener('submit', e => {
    e.preventDefault();

    const data = new FormData(form);

    hideError();

    request('POST', `http://localhost:${window.PORT}/login`, data)
    .then(res => {
      logged();
    })
    .catch(err => {
      switch (err.statusText) {
        case 'No email provided': 
        case 'No password provided': 
        case 'Invalid Password': 
        case 'Unauthorized': 
          showError(err.statusText);
          break;
        case 'Password not set': 
          passwordLessForm();
          break;
      }
    });
  });

  function showError(text) {
    status.textContent = text;
    status.classList.add('text-danger');
    status.classList.remove('hidden');
  }
  
  function hideError() {
    status.textContent = '';
    status.classList.remove('text-danger');
    status.classList.add('hidden');
  }

  function passwordLessForm() {
    form.classList.add('password-less');
  }

  function logged() {
    form.classList.add('hidden');
    success.classList.remove('hidden');
  }
}