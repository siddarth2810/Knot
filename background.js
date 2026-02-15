const MENU_ID = "clip-to-md-save-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Save selection to Markdown",
    contexts: ["selection"]
  });

  // Default settings
  chrome.storage.sync.get(["saveAs"], (res) => {
    if (typeof res.saveAs === "undefined") chrome.storage.sync.set({ saveAs: false });
  });
});

function sendOpenClipper(tabId, selectionText) {
  chrome.tabs.sendMessage(tabId, { type: "OPEN_CLIPPER", selectionText: selectionText || "" }, async () => {
    if (!chrome.runtime.lastError) return;

    // Some pages do not allow content scripts (chrome://, webstore, etc.).
    // For normal pages, try to inject the content script once and resend.
    try {
      const tab = await chrome.tabs.get(tabId);
      const url = tab?.url || "";
      const restricted =
        url.startsWith("chrome://") ||
        url.startsWith("chrome-extension://") ||
        url.startsWith("edge://") ||
        url.startsWith("about:") ||
        url.startsWith("view-source:") ||
        url.includes("chromewebstore.google.com");

      if (restricted) {
        console.debug("Clipper unavailable on restricted page:", url);
        return;
      }

      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["contentScript.js"]
      });

      chrome.tabs.sendMessage(tabId, { type: "OPEN_CLIPPER", selectionText: selectionText || "" }, () => {
        if (chrome.runtime.lastError) {
          console.warn("Failed to open clipper:", chrome.runtime.lastError.message);
        }
      });
    } catch (err) {
      console.warn("Could not inject/open clipper:", err);
    }
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab?.id) {
    sendOpenClipper(tab.id, info.selectionText);
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) sendOpenClipper(tab.id, "");
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-clipper") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) sendOpenClipper(tab.id, "");
});

function slugify(input) {
  return (input || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "clip";
}

function formatLocalISOWithOffset(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  const tz = -date.getTimezoneOffset(); // minutes east of UTC
  const sign = tz >= 0 ? "+" : "-";
  const tzh = pad(Math.floor(Math.abs(tz) / 60));
  const tzm = pad(Math.abs(tz) % 60);

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${tzh}:${tzm}`;
}

function buildMarkdown(payload) {
  const {
    url,
    title,
    highlight,
    takeaway,
    imageDataUrl,
    imageName,
    tags,
    source,
    createdAt
  } = payload;

  const safeTags = (tags || [])
    .map(t => t.trim())
    .filter(Boolean);

  const fmTags = safeTags.length ? `[${safeTags.map(t => JSON.stringify(t)).join(", ")}]` : "[]";

  const escapedTitle = (title || "").replace(/"/g, '\\"');
  const escapedUrl = (url || "").replace(/"/g, '\\"');
  const hasImage = typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:image/");
  const safeImageName = (imageName || "image").replace(/[\[\]]/g, "");

  return `---
type: clip
source: ${source}
url: "${escapedUrl}"
title: "${escapedTitle}"
created_at: ${createdAt}
tags: ${fmTags}
---

## Highlight
${highlight?.trim() ? `> ${highlight.trim().replace(/\n/g, "\n> ")}` : "_(no highlight captured)_"}

## Takeaway
${takeaway?.trim() ? takeaway.trim() : "_(optional)_"}

## Image
${hasImage ? `![${safeImageName}](${imageDataUrl})` : "_(none)_"}

`;
}

async function saveMarkdownFile({ markdown, filename, saveAs }) {
  const dataUrl = "data:text/markdown;charset=utf-8," + encodeURIComponent(markdown);

  await chrome.downloads.download({
    url: dataUrl,
    filename,
    saveAs: !!saveAs,
    conflictAction: "uniquify"
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type !== "SAVE_CLIP") return;

    const { url, title, highlight, takeaway, tags, imageDataUrl, imageName } = msg.payload || {};
    const createdAt = formatLocalISOWithOffset(new Date());
    const host = (() => {
      try { return new URL(url).hostname; } catch { return ""; }
    })();

    const source = (host.includes("chatgpt.com") || host.includes("chat.openai.com")) ? "chatgpt" : "web";

    const markdown = buildMarkdown({
      url,
      title,
      highlight,
      takeaway,
      imageDataUrl,
      imageName,
      tags,
      source,
      createdAt
    });

    const datePart = createdAt.slice(0, 10);
    const timePart = createdAt.slice(11, 19).replace(/:/g, "");
    const base = slugify(title);
    const filename = `clips/${datePart}__${base}__${timePart}.md`;

    const { saveAs } = await chrome.storage.sync.get(["saveAs"]);
    await saveMarkdownFile({ markdown, filename, saveAs });

    sendResponse({ ok: true });
  })().catch((err) => {
    console.error(err);
    sendResponse({ ok: false, error: String(err) });
  });

  return true; // keep the message channel open for async response
});
