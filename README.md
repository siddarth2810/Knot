# Knot

Clip highlights or build multi-site Markdown dossiers — straight into your Obsidian vault.

## Features

### Clip Mode

Select text on any page → click the extension icon → **Clip** tab → **Open Clipper on Page** (or <kbd>Ctrl+Shift+S</kbd>).
A floating panel appears on the page where you add a takeaway, tags, and optional image, then **Save**. The clip downloads as a `.md` file to `Downloads/clips/`.

### Blog Mode (Dossier)

Build a **single growing Markdown file** for a research topic while browsing many sites.

1. Click the extension icon → **Blog Mode** tab.
2. Enter a **topic title** + optional tags → **Start Topic**.
3. Browse articles. Whenever you find something useful:
   - Select text on the page.
   - Click the extension icon → **Add Highlight** (captures URL + title + selection + your takeaway).
   - Or click **Add Note** to add a free-form note.
4. Each addition appends an entry to `Downloads/clips/dossiers/<topic-slug>.md` and overwrites the file so it keeps growing.
5. When done, click **Finish Topic**.

**Key properties:**

- State persists across tabs, domains, and browser restarts (stored in `chrome.storage.local`).
- One `.md` file per topic — never duplicated with `(1)` suffixes.
- Recent topics list lets you reopen or re-download any dossier.
- No LLM / external API calls — purely local capture.

### Dossier file format

```yaml
---
type: dossier
topic: "Floating Point Deep Dive"
created_at: 2026-02-15T14:00:00+05:30
updated_at: 2026-02-15T15:22:10+05:30
tags: ["programming", "numerics"]
entry_count: 3
sources:
  - https://en.algorithmica.org/hpc/arithmetic/float/
---
```

Each entry under `## Entries` includes timestamp, URL, highlight (blockquote), takeaway, and/or note.

## Installation

1. Clone / download this repo.
2. Go to `chrome://extensions` → enable **Developer mode**.
3. Click **Load unpacked** → select the repo folder.
4. Pin the extension for quick access.

**Tip:** Set your Chrome Downloads folder to your Obsidian vault's inbox for instant sync.

## Manual Test Checklist

- [ ] Click extension icon — popup opens with **Clip** and **Blog Mode** tabs.
- [ ] Clip tab → **Open Clipper on Page** opens the floating panel.
- [ ] <kbd>Ctrl+Shift+S</kbd> still opens the in-page clipper.
- [ ] Right-click selection → "Save selection to Markdown" works.
- [ ] Blog Mode → Start Topic creates `Downloads/clips/dossiers/<slug>.md`.
- [ ] Add Highlight from site A → entry appears in file.
- [ ] Switch to site B → Add Highlight → same file updated with new entry.
- [ ] Close & reopen browser → active topic persists.
- [ ] Add Note → free-form note appended.
- [ ] Finish Topic → returns to start screen; dossier file kept.
- [ ] Reopen a recent topic → Add Highlight continues appending.
- [ ] Re-download button triggers a fresh download of the current dossier.
