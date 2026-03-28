(function () {
  var script =
    document.currentScript ||
    document.querySelector('script[src*="/js/landing-tracking.js"]');

  var TOKEN =
    script && script.dataset && script.dataset.token
      ? script.dataset.token.trim()
      : "";

  var PAGE =
    script && script.dataset && script.dataset.page
      ? script.dataset.page
      : "";

  if (!TOKEN) return;

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
        if (
          !raw ||
          raw.startsWith("#") ||
          raw.startsWith("mailto:") ||
          raw.startsWith("tel:")
        ) {
          return;
        }

        var u = new URL(raw, window.location.origin);

        if (
          (u.protocol === "http:" || u.protocol === "https:") &&
          !u.searchParams.has("t")
        ) {
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

  async function submitAndResolve(meta) {
    var url = "/t/s/" + encodeURIComponent(TOKEN);

    var response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meta || {}),
      credentials: "same-origin",
      keepalive: true,
    });

    var data = null;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    return data || { ok: false };
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

  document.addEventListener(
    "submit",
    async function (ev) {
      var form = ev.target;
      if (!form) return;

      ensureFormToken(form);

      var blockAttr = (form.getAttribute("data-lp-block-submit") || "").toLowerCase();
      var blockSubmit = blockAttr === "1" || blockAttr === "true";

      if (!blockSubmit) return;

      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      var btn = null;
      try {
        btn = form.querySelector('button[type="submit"],input[type="submit"]');
        if (btn) btn.disabled = true;
      } catch (e) {}

      try {
        var result = await submitAndResolve({
          pageSlug: PAGE,
          submitted: true,
        });

        if (result && result.redirectTo) {
          window.location.assign(result.redirectTo);
          return;
        }

        var note = document.createElement("div");
        note.setAttribute("role", "status");
        note.textContent = "Děkujeme. Ověření bylo přijato.";
        form.appendChild(note);
      } catch (e) {
        var err = document.createElement("div");
        err.setAttribute("role", "alert");
        err.textContent = "Nepodařilo se dokončit ověření. Zkuste to prosím znovu.";
        form.appendChild(err);
        if (btn) btn.disabled = false;
      }
    },
    true
  );
})();