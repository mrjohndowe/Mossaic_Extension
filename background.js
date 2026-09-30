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
