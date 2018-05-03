window.showFeedbackFeedback = function(target, message, {confirmation} = {}) {
  let el = target.parentNode.querySelector('.feedback-feedback');
  el.classList.toggle('confirmation', confirmation);
  el.classList.toggle('hint', !confirmation);
  el.innerHTML = message;
}

window.hideFeedbackFeedback = function(target) {
  let el = target.parentNode.querySelector('.feedback-feedback');
  el.classList.remove('hint');
}