importScripts("dossier.js");

const MENU_ID = "clip-to-md-save-selection";
const BLOG_MENU_ID = "knot-add-selection-to-blog";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Save selection to Markdown",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: BLOG_MENU_ID,
    title: "Add selection to active Blog topic",
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

function sendOpenBlogCapture(tabId, selectionText) {
  chrome.tabs.sendMessage(tabId, { type: "OPEN_BLOG_CAPTURE", selectionText: selectionText || "" }, async () => {
    if (!chrome.runtime.lastError) return;

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
        console.debug("Blog capture unavailable on restricted page:", url);
        return;
      }

      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["contentScript.js"]
      });

      chrome.tabs.sendMessage(tabId, { type: "OPEN_BLOG_CAPTURE", selectionText: selectionText || "" }, () => {
        if (chrome.runtime.lastError) {
          console.warn("Failed to open blog capture:", chrome.runtime.lastError.message);
        }
      });
    } catch (err) {
      console.warn("Could not inject/open blog capture:", err);
    }
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab?.id) {
    sendOpenClipper(tab.id, info.selectionText);
  }
  if (info.menuItemId === BLOG_MENU_ID && tab?.id) {
    sendOpenBlogCapture(tab.id, info.selectionText);
  }
});

// NOTE: chrome.action.onClicked does NOT fire when default_popup is set.
// The popup sends OPEN_CLIPPER_FROM_POPUP instead.

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-clipper" && command !== "open-blog-capture") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === "open-clipper") {
    sendOpenClipper(tab.id, "");
    return;
  }

  sendOpenBlogCapture(tab.id, "");
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

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchImageAsDataUrl(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);

  const blob = await res.blob();
  if (!blob.type || !blob.type.startsWith("image/")) {
    throw new Error("Dropped URL is not an image");
  }

  const base64 = arrayBufferToBase64(await blob.arrayBuffer());
  return `data:${blob.type};base64,${base64}`;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Popup asks us to open the in-page clipper
  if (msg?.type === "OPEN_CLIPPER_FROM_POPUP") {
    const tabId = msg.tabId;
    if (tabId) sendOpenClipper(tabId, "");
    return;  // synchronous, no sendResponse needed
  }

  if (msg?.type === "OPEN_BLOG_CAPTURE_FROM_POPUP") {
    const tabId = msg.tabId;
    if (tabId) sendOpenBlogCapture(tabId, "");
    return;
  }

  if (msg?.type === "ADD_TO_ACTIVE_DOSSIER") {
    (async () => {
      const activeId = await dossierGetActiveId();
      if (!activeId) {
        sendResponse({ ok: false, error: "No active Blog topic. Start one from the extension popup first." });
        return;
      }

      const {
        url,
        title,
        highlight,
        takeaway,
        note,
        imageDataUrl,
        imageName,
      } = msg.payload || {};

      const res = await dossierAddEntry(activeId, {
        url,
        pageTitle: title,
        highlight: highlight || "",
        takeaway: takeaway || "",
        note: note || "",
        imageDataUrl: imageDataUrl || "",
        imageName: imageName || "",
      });

      sendResponse({ ok: true, entryCount: res.entryCount, filename: res.meta?.filename || "" });
    })().catch((err) => {
      sendResponse({ ok: false, error: String(err?.message || err) });
    });
    return true;
  }

  if (msg?.type === "FETCH_IMAGE_AS_DATA_URL") {
    (async () => {
      const inputUrl = String(msg.url || "").trim();
      if (!inputUrl) throw new Error("Missing image URL");

      if (inputUrl.startsWith("data:image/")) {
        sendResponse({ ok: true, dataUrl: inputUrl });
        return;
      }

      const dataUrl = await fetchImageAsDataUrl(inputUrl);
      sendResponse({ ok: true, dataUrl });
    })().catch((err) => {
      sendResponse({ ok: false, error: String(err?.message || err) });
    });
    return true;
  }

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
