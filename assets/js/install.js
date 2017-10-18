window.initInstall = function initInstall() {}

window.submitEvent = function(event) {
  const form = document.querySelector('form');
  const eventInput = form.querySelector('input[name="event"]');
  eventInput.value = event;
  request(form.method, form.action, new FormData(form));
}