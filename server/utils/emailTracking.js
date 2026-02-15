// server/utils/emailTracking.js

const TRACKING_BASE =
  (process.env.TRACKING_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    "http://localhost:5000").replace(/\/$/, "");

// jednoduchý replacer {{key}}
export function renderEmailTemplate(html, context = {}) {
  if (!html) return "";
  return String(html).replace(/{{\s*(\w+)\s*}}/g, (_match, key) => {
    const value = context[key];
    return value == null ? "" : String(value);
  });
}

function shouldSkipHref(url) {
  if (!url) return true;
  const u = url.trim();
  if (!u) return true;

  const lower = u.toLowerCase();
  return (
    u.startsWith("#") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("javascript:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("sms:") ||
    lower.startsWith("data:")
  );
}

export function instrumentEmailHtml(html, trackingToken) {
  if (!html || !trackingToken) return html || "";

  let result = String(html);

  // už má pixel s tímto tokenem -> nepřidávej znovu
  const openPixelPath = `/t/o/${trackingToken}.gif`;
  if (!result.includes(openPixelPath)) {
    // 1) OPEN pixel
    const openPixelUrl = `${TRACKING_BASE}${openPixelPath}`;
    const pixelTag = `<img src="${openPixelUrl}" width="1" height="1" style="display:none" alt="" />`;

    if (result.match(/<\/body>/i)) {
      result = result.replace(/<\/body>/i, `${pixelTag}</body>`);
    } else {
      result += pixelTag;
    }
  }

  // 2) přepsat odkazy na CLICK tracking (podpora " i ')
  const trackedPrefix = `${TRACKING_BASE}/t/c/`;

  result = result.replace(/href=(["'])(.*?)\1/gi, (match, quote, href) => {
    const url = String(href || "").trim();

    // už je trackovaný -> nesahej na to
    if (url.startsWith(trackedPrefix)) return match;

    if (shouldSkipHref(url)) return match;

    let finalUrl = url;

    // auto-append token pro landing pages (jen pokud už tam token není)
    try {
      const u = new URL(finalUrl, TRACKING_BASE);
      if (u.pathname.startsWith("/lp/") && !u.searchParams.get("t")) {
        u.searchParams.set("t", trackingToken);
        finalUrl = u.toString();
      }
    } catch (_) {
      // když URL neprojde, nech to být (nesnaž se přepisovat)
      return match;
    }

    const encoded = encodeURIComponent(finalUrl);
    const tracked = `${TRACKING_BASE}/t/c/${trackingToken}?u=${encoded}`;
    return `href=${quote}${tracked}${quote}`;
  });

  return result;
}
