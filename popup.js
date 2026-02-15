/* ──────────────────────────────────────────────────────────
   popup.js  –  Knot popup controller
   ────────────────────────────────────────────────────────── */

/* ---------- DOM refs ---------- */
const $ = (id) => document.getElementById(id);

// Tabs
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

// Clip tab
const clipOpenBtn = $("clipOpenBtn");

// Blog tab – start
const blogStartSection = $("blogStartSection");
const topicInput = $("topicInput");
const topicTagsInput = $("topicTagsInput");
const startTopicBtn = $("startTopicBtn");
const startToast = $("startToast");
const recentSection = $("recentSection");
const recentList = $("recentList");

// Blog tab – active
const blogActiveSection = $("blogActiveSection");
const activeTopic = $("activeTopic");
const activeStats = $("activeStats");
const activePath = $("activePath");
const redownloadBtn = $("redownloadBtn");
const finishTopicBtn = $("finishTopicBtn");
const blogToast = $("blogToast");
const openBlogCaptureBtn = $("openBlogCaptureBtn");

// Options link
$("optionsLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

/* ---------- Tab switching ---------- */
tabs.forEach((t) => {
  t.addEventListener("click", () => {
    tabs.forEach((x) => x.classList.remove("active"));
    panels.forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    document.getElementById(`panel-${t.dataset.tab}`).classList.add("active");
  });
});

/* ---------- Helpers ---------- */
function toast(el, msg, cls) {
  el.className = "toast" + (cls ? ` ${cls}` : "");
  el.textContent = msg;
}

function clearToast(el) {
  el.className = "toast";
  el.textContent = "";
}

let _busy = false;
async function withLock(fn) {
  if (_busy) return;
  _busy = true;
  try { await fn(); }
  finally { _busy = false; }
}

function relativeTime(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch { return ""; }
}

/* ---------- Render state ---------- */
async function render() {
  const state = await dossierGetState();

  if (state.activeId && state.meta) {
    blogStartSection.classList.add("hidden");
    blogActiveSection.classList.remove("hidden");

    activeTopic.textContent = state.meta.topic;
    activeStats.innerHTML = `${state.meta.entryCount} entries · updated ${relativeTime(state.meta.updated_at)} · ${state.meta.sources?.length || 0} sources`;
    activePath.textContent = `Downloads/${state.meta.filename}`;

    // auto-switch to blog tab
    tabs.forEach((x) => x.classList.remove("active"));
    panels.forEach((x) => x.classList.remove("active"));
    document.querySelector('[data-tab="blog"]').classList.add("active");
    document.getElementById("panel-blog").classList.add("active");
  } else {
    blogStartSection.classList.remove("hidden");
    blogActiveSection.classList.add("hidden");
  }

  // Recent topics
  if (state.recent.length > 0) {
    recentSection.classList.remove("hidden");
    recentList.innerHTML = "";
    state.recent.forEach((d) => {
      const isActive = d.id === state.activeId;
      const item = document.createElement("div");
      item.className = "recent-item";
      item.innerHTML = `
        <div class="info">
          <div class="name">${esc(d.topic)}</div>
          <div class="sub">${d.entryCount} entries · ${relativeTime(d.updated_at)}</div>
        </div>
        <div class="actions">
          ${isActive ? '<span style="font-size:10px;color:var(--accent);">active</span>' : `<button class="btn sm reopen-btn" data-id="${d.id}">Reopen</button>`}
          <button class="btn sm dl-btn" data-id="${d.id}">↓</button>
        </div>
      `;
      recentList.appendChild(item);
    });

    recentList.querySelectorAll(".reopen-btn").forEach((b) =>
      b.addEventListener("click", async () => {
        await withLock(async () => {
          await dossierReopen(b.dataset.id);
          clearToast(blogToast);
          await render();
        });
      })
    );
    recentList.querySelectorAll(".dl-btn").forEach((b) =>
      b.addEventListener("click", async () => {
        try { await dossierRedownload(b.dataset.id); } catch (e) { console.warn(e); }
      })
    );
  } else {
    recentSection.classList.add("hidden");
  }
}

function esc(s) {
  const el = document.createElement("span");
  el.textContent = s || "";
  return el.innerHTML;
}

/* ---------- Clip tab ---------- */
clipOpenBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.runtime.sendMessage({ type: "OPEN_CLIPPER_FROM_POPUP", tabId: tab.id });
    window.close();
  }
});

openBlogCaptureBtn?.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.runtime.sendMessage({ type: "OPEN_BLOG_CAPTURE_FROM_POPUP", tabId: tab.id });
    window.close();
  }
});

/* ---------- Blog: Start Topic ---------- */
startTopicBtn.addEventListener("click", () => withLock(async () => {
  clearToast(startToast);
  const topic = topicInput.value.trim();
  if (!topic) {
    toast(startToast, "Please enter a topic title.", "err");
    return;
  }
  const tags = topicTagsInput.value.split(",").map(s => s.trim()).filter(Boolean);

  try {
    await dossierStart({ topic, tags });
    topicInput.value = "";
    topicTagsInput.value = "";
    toast(startToast, "Topic started!", "ok");
    await render();
  } catch (err) {
    toast(startToast, `Error: ${err.message || err}`, "err");
  }
}));

/* ---------- Blog: Re-download ---------- */
redownloadBtn.addEventListener("click", () => withLock(async () => {
  clearToast(blogToast);
  const activeId = await dossierGetActiveId();
  if (!activeId) return;
  try {
    await dossierRedownload(activeId);
    toast(blogToast, "File re-downloaded.", "ok");
  } catch (err) {
    toast(blogToast, `Error: ${err.message || err}`, "err");
  }
}));

/* ---------- Blog: Finish Topic ---------- */
finishTopicBtn.addEventListener("click", () => withLock(async () => {
  clearToast(blogToast);
  const activeId = await dossierGetActiveId();
  if (!activeId) return;
  try {
    await dossierFinish(activeId);
    toast(startToast, "Topic finished. Dossier kept in Downloads.", "ok");
    await render();
  } catch (err) {
    toast(blogToast, `Error: ${err.message || err}`, "err");
  }
}));

/* ---------- Init ---------- */
render();
