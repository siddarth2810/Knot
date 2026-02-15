/* ──────────────────────────────────────────────────────────
   dossier.js  –  Shared helpers for Blog-Mode dossiers
   Loaded by: background.js (importScripts) & popup.js
   ────────────────────────────────────────────────────────── */

/* ---------- tiny helpers ---------- */

function dossierSlugify(input) {
  return (input || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "dossier";
}

function dossierNowISO(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const tzh = pad(Math.floor(Math.abs(tz) / 60));
  const tzm = pad(Math.abs(tz) % 60);
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${tzh}:${tzm}`;
}

function dossierShortTimestamp(iso) {
  // "2026-02-15 15:22 (+05:30)"
  const d = iso || dossierNowISO();
  const date = d.slice(0, 10);
  const time = d.slice(11, 16);
  const tz = d.slice(19); // "+05:30"
  return `${date} ${time} (${tz})`;
}

/* ---------- ID generator ---------- */

function dossierNewId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------- Storage helpers (chrome.storage.local) ---------- */

async function dossierGetIndex() {
  const res = await chrome.storage.local.get("dossiersIndex");
  return res.dossiersIndex || {};
}

async function dossierSetIndex(index) {
  await chrome.storage.local.set({ dossiersIndex: index });
}

async function dossierGetActiveId() {
  const res = await chrome.storage.local.get("activeDossierId");
  return res.activeDossierId || null;
}

async function dossierSetActiveId(id) {
  await chrome.storage.local.set({ activeDossierId: id });
}

async function dossierGetContent(id) {
  const key = `dossierContent:${id}`;
  const res = await chrome.storage.local.get(key);
  return res[key] || "";
}

async function dossierSetContent(id, md) {
  await chrome.storage.local.set({ [`dossierContent:${id}`]: md });
}

/* ---------- Markdown builder ---------- */

function dossierBuildFrontmatter(meta) {
  const tags = (meta.tags || []).map(t => JSON.stringify(t)).join(", ");
  const sources = (meta.sources || []).map(u => `  - ${u}`).join("\n");
  return [
    "---",
    "type: dossier",
    `topic: "${(meta.topic || "").replace(/"/g, '\\"')}"`,
    `created_at: ${meta.created_at}`,
    `updated_at: ${meta.updated_at}`,
    `tags: [${tags}]`,
    `entry_count: ${meta.entryCount || 0}`,
    sources ? `sources:\n${sources}` : "sources: []",
    "---",
  ].join("\n");
}

function dossierBuildEntry(entry) {
  const ts = dossierShortTimestamp(entry.timestamp);
  const heading = entry.pageTitle
    ? `### ${ts} — ${entry.pageTitle}`
    : `### ${ts} — Note`;

  const lines = [heading];
  if (entry.url) lines.push(`URL: ${entry.url}`);
  lines.push("");

  if (entry.highlight?.trim()) {
    lines.push("**Highlight**");
    lines.push(`> ${entry.highlight.trim().replace(/\n/g, "\n> ")}`);
    lines.push("");
  }

  if (entry.takeaway?.trim()) {
    lines.push("**Takeaway**");
    lines.push(entry.takeaway.trim());
    lines.push("");
  }

  if (entry.note?.trim()) {
    lines.push("**Note**");
    lines.push(entry.note.trim());
    lines.push("");
  }

  if (entry.imageDataUrl && entry.imageDataUrl.startsWith("data:image/")) {
    const safeName = (entry.imageName || "image").replace(/[\[\]]/g, "");
    lines.push("**Image**");
    lines.push(`![${safeName}](${entry.imageDataUrl})`);
    lines.push("");
  }

  return lines.join("\n");
}

function dossierBuildMarkdown(meta, entries) {
  const fm = dossierBuildFrontmatter(meta);
  const title = `# ${meta.topic}`;
  const body = entries.length
    ? entries.map(dossierBuildEntry).join("\n---\n\n")
    : "_(no entries yet)_";

  return `${fm}\n\n${title}\n\n## Entries\n\n${body}\n`;
}

/* ---------- Core operations ---------- */

async function dossierStart({ topic, tags }) {
  const id = dossierNewId();
  const now = dossierNowISO();
  const slug = dossierSlugify(topic);
  const filename = `clips/dossiers/${slug}.md`;

  const meta = {
    id,
    topic,
    slug,
    created_at: now,
    updated_at: now,
    tags: tags || [],
    entryCount: 0,
    sources: [],
    filename,
  };

  const index = await dossierGetIndex();
  index[id] = meta;
  await dossierSetIndex(index);
  await dossierSetContent(id, JSON.stringify([])); // entries as JSON array
  await dossierSetActiveId(id);

  // Initial empty download
  const md = dossierBuildMarkdown(meta, []);
  await dossierDownload(md, filename);

  return meta;
}

async function dossierAddEntry(id, entry) {
  const index = await dossierGetIndex();
  const meta = index[id];
  if (!meta) throw new Error("Dossier not found");

  const raw = await dossierGetContent(id);
  const entries = JSON.parse(raw || "[]");

  const now = dossierNowISO();
  const newEntry = { ...entry, timestamp: now };
  entries.push(newEntry);

  // Update meta
  meta.updated_at = now;
  meta.entryCount = entries.length;
  if (entry.url && !meta.sources.includes(entry.url)) {
    meta.sources.push(entry.url);
  }

  // Persist
  index[id] = meta;
  await dossierSetIndex(index);
  await dossierSetContent(id, JSON.stringify(entries));

  // Download updated file
  const md = dossierBuildMarkdown(meta, entries);
  await dossierDownload(md, meta.filename);

  return { meta, entryCount: entries.length };
}

async function dossierFinish(id) {
  await dossierSetActiveId(null);
  // Keep data — user can reopen later
}

async function dossierReopen(id) {
  const index = await dossierGetIndex();
  if (!index[id]) throw new Error("Dossier not found");
  await dossierSetActiveId(id);
  return index[id];
}

async function dossierGetState() {
  const activeId = await dossierGetActiveId();
  const index = await dossierGetIndex();
  const meta = activeId ? (index[activeId] || null) : null;
  // Recent: sorted by updated_at desc, last 5
  const recent = Object.values(index)
    .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))
    .slice(0, 5);
  return { activeId, meta, recent };
}

async function dossierRedownload(id) {
  const index = await dossierGetIndex();
  const meta = index[id];
  if (!meta) throw new Error("Dossier not found");
  const raw = await dossierGetContent(id);
  const entries = JSON.parse(raw || "[]");
  const md = dossierBuildMarkdown(meta, entries);
  await dossierDownload(md, meta.filename);
  return { ok: true };
}

/* ---------- Download helper ---------- */

const DOSSIER_SIZE_WARN = 4 * 1024 * 1024; // 4 MB

async function dossierDownload(markdown, filename) {
  if (markdown.length > DOSSIER_SIZE_WARN) {
    console.warn("Dossier is very large:", (markdown.length / 1024 / 1024).toFixed(1), "MB");
  }

  const dataUrl = "data:text/markdown;charset=utf-8," + encodeURIComponent(markdown);

  await chrome.downloads.download({
    url: dataUrl,
    filename,
    conflictAction: "overwrite",
    saveAs: false,
  });
}
