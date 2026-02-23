document.addEventListener("click", function (e) {
  var btn = e.target.closest('[data-action="next-step"]');
  if (!btn) return;

  e.preventDefault();

  var step1 = document.getElementById("step1");
  var step2 = document.getElementById("step2");

  if (step1) step1.hidden = true;
  if (step2) step2.hidden = false;
});

document.addEventListener("submit", function (e) {
  if (!e.target.matches("#fake-login-form")) return;

  // Pokud chceš jen UI změnu (a tracking řeší /js/landing-tracking.js), můžeš submit zablokovat tady:
  e.preventDefault();

  var form = e.target;
  var msg = document.createElement("div");
  msg.setAttribute("role", "status");
  msg.textContent = "Probíhá ověření...";
  form.appendChild(msg);
});