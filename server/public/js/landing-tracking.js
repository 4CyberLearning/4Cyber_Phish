
// server/public/js/landing-tracking.js
(function () {
  var script =
    document.currentScript ||
    document.querySelector('script[src*="/js/landing-tracking.js"]');

  var TOKEN = (script && script.dataset && script.dataset.token) ? script.dataset.token.trim() : "";
  var PAGE = (script && script.dataset && script.dataset.page) ? script.dataset.page : "";

  if (!TOKEN) return;

  function sendSubmit(meta) {
    var payload = JSON.stringify(meta || {});
    var url = "/t/s/" + encodeURIComponent(TOKEN);

    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      credentials: "same-origin",
      keepalive: true
    }).then(function (res) {
      if (!res.ok) {
        throw new Error("submit_tracking_failed");
      }
      return res.json();
    });
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

  function setFormBusy(form, busy) {
    try {
      var controls = form.querySelectorAll("button, input, select, textarea");
      controls.forEach(function (node) {
        if (busy) {
          node.setAttribute("data-lp-was-disabled", node.disabled ? "1" : "0");
          node.disabled = true;
        } else if (node.getAttribute("data-lp-was-disabled") === "0") {
          node.disabled = false;
          node.removeAttribute("data-lp-was-disabled");
        }
      });
    } catch (e) {}
  }

  function showSubmitNote(form, text) {
    try {
      var existing = form.querySelector('[data-lp-submit-note="1"]');
      if (existing) existing.remove();

      var note = document.createElement("div");
      note.setAttribute("role", "status");
      note.setAttribute("data-lp-submit-note", "1");
      note.style.marginTop = "12px";
      note.style.fontSize = "13px";
      note.style.color = "#374151";
      note.textContent = text;
      form.appendChild(note);
    } catch (e) {}
  }

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

  document.addEventListener("submit", function (ev) {
    var form = ev.target;
    if (!form) return;

    ensureFormToken(form);

    ev.preventDefault();
    ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

    setFormBusy(form, true);

    sendSubmit({ pageSlug: PAGE, submitted: true })
      .then(function (result) {
        var redirectTo = result && result.redirectTo ? String(result.redirectTo) : "";
        if (redirectTo) {
          window.location.assign(redirectTo);
          return;
        }

        showSubmitNote(form, "Děkujeme. Ověření bylo přijato.");
        setFormBusy(form, false);
      })
      .catch(function () {
        showSubmitNote(form, "Nepodařilo se dokončit ověření. Zkuste to prosím znovu.");
        setFormBusy(form, false);
      });
  }, true);
})();
