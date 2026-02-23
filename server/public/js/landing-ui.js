// /public/js/landing-ui.js
(function () {
  function showStep(stepName) {
    document.querySelectorAll(".lp-step").forEach(function (el) {
      var step = el.getAttribute("data-lp-step");
      if (step === stepName) {
        el.classList.remove("hidden");
        el.style.opacity = "1";
      } else {
        el.classList.add("hidden");
        el.style.opacity = "0";
      }
    });
  }

  // click handler pro všechny "akce" na stránce
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-lp-next-step],[data-lp-back-step]");
    if (!btn) return;

    var next = btn.getAttribute("data-lp-next-step");
    var back = btn.getAttribute("data-lp-back-step");

    if (next) {
      ev.preventDefault();
      showStep(next);
    } else if (back) {
      ev.preventDefault();
      showStep(back);
    }
  });

  // submit handler – univerzální (např. validace / UI reakce)
  document.addEventListener("submit", function (ev) {
    var form = ev.target.closest(".lp-form");
    if (!form) return;

    // sem si dáš univerzální logiku (např. validation, disable button, atd.)
    // pokud submit nechceš blokovat:
    //  - nevolej preventDefault()
    // pokud ho chceš blokovat pro konkrétní form,
    //  - přidej data-lp-block-submit="1" do HTML

    var blockAttr = (form.getAttribute("data-lp-block-submit") || "").toLowerCase();
    if (blockAttr === "1" || blockAttr === "true") {
      ev.preventDefault();
    }
  }, true);
})();