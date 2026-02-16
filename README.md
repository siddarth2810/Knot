# Knot
<img width="1502" height="900" alt="screenshot-20260215-103239Z-selected" src="https://github.com/user-attachments/assets/42f12f98-2c87-4967-a1a4-1f2b8ccfc769" />


A lightweight **Chrome extension + OpenClaw workflow** for turning what you read on the internet into social posts and blog drafts.

This project is built around a simple idea:

> Capture while learning → structure automatically → ship faster.

---

## Overview

This system has **two capture modes**:

- **Clip mode** → saves small insights from reading
- **Blog mode** → accumulates structured learning for long-form writing

Both modes store content as **markdown files**, which are later used by an **OpenClaw skill** to generate drafts.

---

## Architecture

```
Chrome Extension
   ├── Clip Mode → clips/*.md
   └── Blog Mode → clips/dossiers/<topic>.md

OpenClaw Skills
   ├── ship_post → social draft
   └── blog_draft → blog draft
```

Everything is **local-first** and file-based.

No database required.

---

## Clip Mode

Clip mode is designed for **small learning moments**.

### Workflow

1. Highlight text on any webpage
2. Click **Save Clip**
3. Extension writes a markdown file to:

```
Downloads/clips/
```

Each clip looks like:

```md
---
type: clip
source: web
title: "Floating-Point Numbers - Algorithmica"
url: "https://en.algorithmica.org/hpc/arithmetic/float/"
created_at: 2026-02-15T11:47:17+05:30
tags: ["programming"]
---

## Highlight
> Floating-point numbers store significant digits and scale using an exponent.

## Takeaway
Floating point numbers optimize relative error instead of absolute precision.
```

---

## Clip → Social Post (OpenClaw)
<img width="531" height="428" alt="screenshot-20260216-112513Z-selected" src="https://github.com/user-attachments/assets/ceefab0d-39c8-49a1-a7e2-56d65ca4b3e3" />


An OpenClaw skill reads the newest clip and generates a social post draft.
Save the skill in `.openclaw/skills/ship_post/SKILL.md`

Example command:

```
/ship_post
```

Output:

```
Floating-point numbers store precision using mantissa + exponent.

They optimize relative error instead of exact representation, making numerical computation efficient.

https://en.algorithmica.org/hpc/arithmetic/float/
```

This creates a **low-friction learning → sharing loop**.

---

## Blog Mode
<img width="423" height="368" alt="screenshot-20260216-112350Z-selected" src="https://github.com/user-attachments/assets/d2a04800-01a3-4f25-9812-7d435b251fed" />


Blog mode is designed for **deep learning on a topic**.

Instead of creating many files, it maintains **one evolving markdown file per topic**.

---

### Workflow

1. Choose a topic (example: `floating-point`)
2. Highlight text from articles/videos/docs
3. Extension appends structured content
4. Same markdown file is overwritten with updates
5. File downloads locally

Example location:

```
Downloads/clips/dossiers/floating-point.md
```

---

## Blog Draft Generation (OpenClaw)

An OpenClaw skill converts the blog markdown into a draft article.

Example:

```
/dossier floating-point
```

Output:
- structured explanation
- narrative flow
- draft blog content
- minimal editing required

The goal is:

> Learning notes → coherent blog draft

---

## Why This Exists

Most people:
- read a lot
- save bookmarks
- forget insights

This system instead creates:

```
Reading → Capture → Structure → Ship
```

It reduces friction between **learning and publishing**.

---


## Project Status

Early prototype — actively evolving.

---

## Philosophy

This is not a note-taking tool.

It is a **learning-to-publishing pipeline**.

---
