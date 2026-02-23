// server/public/js/landing-tracking.js
(function () {
  var script =
    document.currentScript ||
    document.querySelector('script[src*="/js/landing-tracking.js"]');

  var TOKEN = (script && script.dataset && script.dataset.token) ? script.dataset.token.trim() : "";
  var PAGE = (script && script.dataset && script.dataset.page) ? script.dataset.page : "";

  if (!TOKEN) return;

  function sendSubmit(meta) {
    try {
      var payload = JSON.stringify(meta);
      var url = "/t/s/" + encodeURIComponent(TOKEN);

      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(url, blob);
        return;
      }

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  function sendOpen() {
    try {
      var img = new Image();
      img.src = "/t/o/" + encodeURIComponent(TOKEN) + ".gif";
    } catch (e) {}
  }

  function appendTokenToLinks() {
    try {
      document.querySelectorAll("a[href]").forEach(function (link) {
        var raw = link.getAttribute("href") || "";
        if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return;

        var u = new URL(raw, window.location.origin);

        if ((u.protocol === "http:" || u.protocol === "https:") && !u.searchParams.has("t")) {
          u.searchParams.set("t", TOKEN);
          link.setAttribute("href", u.toString());
        }
      });
    } catch (e) {}
  }

  function ensureFormToken(form) {
    try {
      if (!form || form.querySelector('input[name="t"]')) return;

      var input = document.createElement("input");
      input.type = "hidden";
      input.name = "t";
      input.value = TOKEN;
      form.appendChild(input);
    } catch (e) {}
  }

  // OPEN tracking + token propagation po načtení
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      sendOpen();
      appendTokenToLinks();
      document.querySelectorAll("form").forEach(ensureFormToken);
    });
  } else {
    sendOpen();
    appendTokenToLinks();
    document.querySelectorAll("form").forEach(ensureFormToken);
  }

  // SUBMIT tracking (capture)
  document.addEventListener("submit", function (ev) {
    var form = ev.target;
    if (!form) return;

    ensureFormToken(form);

    // NOVĚ: default submit NEblokujeme
    var blockAttr = (form.getAttribute("data-block-submit") || "").toLowerCase();
    var blockSubmit = (blockAttr === "1" || blockAttr === "true");

    if (blockSubmit) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }

    sendSubmit({ pageSlug: PAGE, submitted: true });

    if (blockSubmit) {
      try {
        var btn = form.querySelector('button[type="submit"],input[type="submit"]');
        if (btn) btn.disabled = true;

        var note = document.createElement("div");
        note.setAttribute("role", "status");
        note.textContent = "Děkujeme. Ověření bylo přijato.";
        form.appendChild(note);
      } catch (e) {}
    }
  }, true);
})();