// The toolbar icon opens popup.html. This worker only adds an "ON" badge to the icon
// when the current tab is a Reddit page Mosaic can turn into a wall:
//   /r/<sub>, /user/<name>/m/<feed> (custom feed), /user/<name>
const SUPPORTED_RE = /^https:\/\/(?:www\.|old\.)?reddit\.com\/(?:r\/[^/]+|(?:u|user)\/[^/]+)/i;

function updateBadge(tabId, url) {
  if (tabId == null) return;
  const on = SUPPORTED_RE.test(url || "");
  chrome.action.setBadgeText({ tabId, text: on ? "ON" : "" });
  if (on) chrome.action.setBadgeBackgroundColor({ tabId, color: "#ff1f5a" });
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url || info.status === "complete") updateBadge(tabId, tab.url);
});
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (!chrome.runtime.lastError && tab) updateBadge(tabId, tab.url);
  });
});

// Content scripts cannot reliably force a cross-origin media URL to download:
// browsers often ignore an anchor's download attribute and open the URL instead.
// The extension download manager starts a real browser download in the user's
// normal download location and safely creates a unique filename when needed.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "mosaic-download") return;
  let url;
  try {
    url = new URL(message.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("unsupported protocol");
  } catch {
    sendResponse({ ok: false, error: "invalid URL" });
    return;
  }

  chrome.downloads.download(
    {
      url: url.href,
      filename: typeof message.filename === "string" ? message.filename : undefined,
      conflictAction: "uniquify",
      saveAs: false,
    },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true, downloadId });
    }
  );
  return true;
});
