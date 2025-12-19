// server/utils/emailTracking.js
const TRACKING_BASE =
  (process.env.TRACKING_BASE_URL ||
   process.env.PUBLIC_BASE_URL ||
   "http://localhost:5000").replace(/\/$/, "");

// jednoduchý replacer {{key}}
export function renderEmailTemplate(html, context = {}) {
  if (!html) return "";
  return html.replace(/{{\s*(\w+)\s*}}/g, (_match, key) => {
    const value = context[key];
    return value == null ? "" : String(value);
  });
}

export function instrumentEmailHtml(html, trackingToken) {
  if (!html || !trackingToken) return html || "";

  let result = html;

  // 1) OPEN pixel
  const openPixelUrl = `${TRACKING_BASE}/t/o/${trackingToken}.gif`;
  const pixelTag =
    `<img src="${openPixelUrl}" width="1" height="1" style="display:none" alt="" />`;

  if (result.match(/<\/body>/i)) {
    result = result.replace(/<\/body>/i, `${pixelTag}</body>`);
  } else {
    result += pixelTag;
  }

  // 2) přepsat odkazy na CLICK tracking
  result = result.replace(/href="([^"]+)"/gi, (match, href) => {
    const url = href.trim();
    if (
      !url ||
      url.startsWith("#") ||
      url.toLowerCase().startsWith("mailto:") ||
      url.toLowerCase().startsWith("javascript:")
    ) {
      return match;
    }

    const encoded = encodeURIComponent(url);
    const tracked = `${TRACKING_BASE}/t/c/${trackingToken}?u=${encoded}`;
    return `href="${tracked}"`;
  });

  return result;
}
