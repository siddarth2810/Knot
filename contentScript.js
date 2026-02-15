if (!globalThis.__clipToMdInitialized) {
  globalThis.__clipToMdInitialized = true;

  let panelRoot = null;
  let latestSelectionText = "";
  let droppedImageDataUrl = "";
  let droppedImageName = "";

  function normalizeText(value) {
    return (value || "").replace(/\s+$/g, "").trim();
  }

  function getSelectionFromInput() {
    const el = document.activeElement;
    if (!el) return "";

    const isTextInput = el instanceof HTMLInputElement && /^(text|search|url|tel|email|password)$/i.test(el.type);
    const isTextarea = el instanceof HTMLTextAreaElement;
    if (!isTextInput && !isTextarea) return "";

    const start = typeof el.selectionStart === "number" ? el.selectionStart : 0;
    const end = typeof el.selectionEnd === "number" ? el.selectionEnd : 0;
    if (end <= start) return "";
    return normalizeText(el.value.slice(start, end));
  }

  function getLiveSelectionText() {
    const fromInput = getSelectionFromInput();
    if (fromInput) return fromInput;

    const fromWindow = normalizeText(window.getSelection()?.toString() || "");
    return fromWindow;
  }

  function captureLatestSelection() {
    const current = getLiveSelectionText();
    if (current) latestSelectionText = current;
  }

  document.addEventListener("selectionchange", captureLatestSelection, true);
  document.addEventListener("mouseup", captureLatestSelection, true);
  document.addEventListener("keyup", captureLatestSelection, true);

  function ensurePanel() {
    if (panelRoot) return panelRoot;

    panelRoot = document.createElement("div");
    panelRoot.id = "clip-to-md-panel-root";
    panelRoot.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .wrap {
        position: fixed;
        right: 20px;
        bottom: 20px;
        width: 430px;
        max-width: calc(100vw - 24px);
        background: linear-gradient(160deg, #0f172a 0%, #111827 45%, #020617 100%);
        color: #e5e7eb;
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 16px;
        box-shadow: 0 20px 48px rgba(2,6,23,0.6);
        backdrop-filter: blur(8px);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        z-index: 2147483647;
        overflow: hidden;
      }
      .hdr {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.25);
      }
      .title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.2px;
      }
      .actions {
        display: flex;
        gap: 8px;
      }
      .btn {
        appearance: none;
        background: rgba(148, 163, 184, 0.12);
        color: #e5e7eb;
        border: 1px solid rgba(148, 163, 184, 0.3);
        border-radius: 9px;
        padding: 6px 10px;
        cursor: pointer;
        font-size: 12px;
        line-height: 1.2;
      }
      .btn:hover { background: rgba(148, 163, 184, 0.2); }
      .btn.primary {
        background: linear-gradient(145deg, #f8fafc, #e2e8f0);
        color: #0f172a;
        border-color: #e2e8f0;
        font-weight: 700;
      }
      .body { padding: 14px; display: grid; gap: 12px; }
      .label { font-size: 12px; color: #cbd5e1; margin-bottom: 6px; }
      textarea, input {
        width: 100%;
        box-sizing: border-box;
        border-radius: 11px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(148, 163, 184, 0.08);
        color: #f8fafc;
        padding: 10px 11px;
        outline: none;
        font-size: 13px;
      }
      textarea { min-height: 90px; resize: vertical; }
      input:focus, textarea:focus {
        border-color: rgba(96, 165, 250, 0.9);
        box-shadow: 0 0 0 2px rgba(59,130,246,0.25);
      }
      .meta {
        font-size: 12px;
        color: #94a3b8;
        line-height: 1.35;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .row { display: flex; gap: 10px; }
      .row > * { flex: 1; }
      .hint { font-size: 11px; color: #94a3b8; margin-top: 4px; }
      .dropzone {
        border: 1px dashed rgba(148, 163, 184, 0.55);
        border-radius: 11px;
        padding: 10px;
        text-align: center;
        font-size: 12px;
        color: #cbd5e1;
        background: rgba(148, 163, 184, 0.06);
        cursor: pointer;
      }
      .dropzone.active {
        border-color: rgba(96, 165, 250, 0.95);
        background: rgba(59,130,246,0.18);
      }
      .preview {
        margin-top: 8px;
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 10px;
        overflow: hidden;
        display: none;
      }
      .preview img {
        display: block;
        max-height: 140px;
        width: 100%;
        object-fit: contain;
        background: rgba(2,6,23,0.55);
      }
      .previewBar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 8px;
        font-size: 11px;
        color: #cbd5e1;
        background: rgba(148, 163, 184, 0.09);
      }
      .toast { font-size: 12px; color: #cbd5e1; min-height: 16px; }
    `;

    const wrap = document.createElement("div");
    wrap.className = "wrap";
    wrap.innerHTML = `
      <div class="hdr">
        <div class="title">Clip to Markdown</div>
        <div class="actions">
          <button class="btn" id="cancelBtn">Close</button>
          <button class="btn primary" id="saveBtn">Save</button>
        </div>
      </div>
      <div class="body">
        <div class="meta" id="metaLine"></div>

        <div>
          <div class="label">Takeaway</div>
          <input id="takeawayInput" placeholder="Why this matters (optional)" />
        </div>

        <div>
          <div class="label">Tags</div>
          <input id="tagsInput" placeholder="web, db, ai" />
        </div>

        <div>
          <div class="row" style="align-items:center;">
            <div class="label" style="margin:0;">Highlight</div>
            <button class="btn" id="refreshHighlightBtn" style="max-width:110px;">Use current</button>
          </div>
          <textarea id="highlightBox" readonly></textarea>
          <div class="hint">Select text, then click Use current if needed.</div>
        </div>

        <div>
          <div class="label">Image (drag & drop or click)</div>
          <div class="dropzone" id="imageDropZone">Drop image here or click to pick</div>
          <input id="imageInput" type="file" accept="image/*" style="display:none;" />
          <div class="preview" id="imagePreviewWrap">
            <img id="imagePreview" alt="Attached image preview" />
            <div class="previewBar">
              <span id="imageName">image</span>
              <button class="btn" id="removeImageBtn">Remove</button>
            </div>
          </div>
        </div>

        <div class="toast" id="toast"></div>
      </div>
    `;

    panelRoot.shadowRoot.appendChild(style);
    panelRoot.shadowRoot.appendChild(wrap);
    document.documentElement.appendChild(panelRoot);

    const close = () => {
      panelRoot?.remove();
      panelRoot = null;
    };

    panelRoot.shadowRoot.getElementById("cancelBtn").addEventListener("click", close);

    window.addEventListener("keydown", (e) => {
      if (!panelRoot) return;
      if (e.key === "Escape") close();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        panelRoot.shadowRoot.getElementById("saveBtn")?.click();
      }
    }, { capture: true });

    return panelRoot;
  }

  function setImagePreview(root, dataUrl, fileName) {
    const previewWrap = root.shadowRoot.getElementById("imagePreviewWrap");
    const preview = root.shadowRoot.getElementById("imagePreview");
    const imageName = root.shadowRoot.getElementById("imageName");

    droppedImageDataUrl = dataUrl || "";
    droppedImageName = fileName || "";

    if (!droppedImageDataUrl) {
      previewWrap.style.display = "none";
      preview.removeAttribute("src");
      imageName.textContent = "";
      return;
    }

    preview.src = droppedImageDataUrl;
    imageName.textContent = droppedImageName || "image";
    previewWrap.style.display = "block";
  }

  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read image file"));
      reader.readAsDataURL(file);
    });
  }

  function openPanel(selectionText) {
    const root = ensurePanel();

    const url = location.href;
    const title = document.title || "Untitled";

    const highlight = normalizeText(selectionText) || latestSelectionText || getLiveSelectionText();

    root.shadowRoot.getElementById("metaLine").textContent = `${title} • ${new URL(url).hostname}`;
    root.shadowRoot.getElementById("highlightBox").value = highlight || "";

    const takeawayInput = root.shadowRoot.getElementById("takeawayInput");
    takeawayInput.value = "";
    takeawayInput.focus();

    const toast = root.shadowRoot.getElementById("toast");
    toast.textContent = highlight ? "" : "Tip: select text first for a better clip.";

    setImagePreview(root, "", "");

    root.shadowRoot.getElementById("refreshHighlightBtn").onclick = () => {
      captureLatestSelection();
      const next = latestSelectionText || getLiveSelectionText();
      root.shadowRoot.getElementById("highlightBox").value = next || "";
      toast.textContent = next ? "Updated highlight from current selection." : "No current selection found.";
    };

    const imageDropZone = root.shadowRoot.getElementById("imageDropZone");
    const imageInput = root.shadowRoot.getElementById("imageInput");

    const onPickFile = async (file) => {
      if (!file || !file.type.startsWith("image/")) {
        toast.textContent = "Please choose an image file.";
        return;
      }
      try {
        const dataUrl = await readImageFile(file);
        setImagePreview(root, dataUrl, file.name || "image");
        toast.textContent = "Image attached.";
      } catch (err) {
        toast.textContent = `Image error: ${String(err.message || err)}`;
      }
    };

    imageDropZone.onclick = () => imageInput.click();
    imageInput.onchange = () => onPickFile(imageInput.files?.[0]);

    imageDropZone.ondragover = (e) => {
      e.preventDefault();
      imageDropZone.classList.add("active");
    };
    imageDropZone.ondragleave = () => imageDropZone.classList.remove("active");
    imageDropZone.ondrop = (e) => {
      e.preventDefault();
      imageDropZone.classList.remove("active");
      onPickFile(e.dataTransfer?.files?.[0]);
    };

    root.shadowRoot.getElementById("removeImageBtn").onclick = () => {
      setImagePreview(root, "", "");
      imageInput.value = "";
      toast.textContent = "Image removed.";
    };

    root.shadowRoot.getElementById("saveBtn").onclick = async () => {
      const tagsRaw = root.shadowRoot.getElementById("tagsInput").value || "";
      const tags = tagsRaw.split(",").map(s => s.trim()).filter(Boolean);

      const payload = {
        url,
        title,
        highlight: root.shadowRoot.getElementById("highlightBox").value || "",
        takeaway: takeawayInput.value || "",
        tags,
        imageDataUrl: droppedImageDataUrl,
        imageName: droppedImageName
      };

      toast.textContent = "Saving…";

      chrome.runtime.sendMessage({ type: "SAVE_CLIP", payload }, (res) => {
        if (chrome.runtime.lastError) {
          toast.textContent = `Error: ${chrome.runtime.lastError.message}`;
          return;
        }
        if (!res?.ok) {
          toast.textContent = `Error: ${res?.error || "unknown"}`;
          return;
        }
        toast.textContent = "Saved ✅ (Downloads/clips/…)";
        setTimeout(() => {
          root?.remove();
          panelRoot = null;
        }, 520);
      });
    };
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "OPEN_CLIPPER") {
      captureLatestSelection();
      openPanel(msg.selectionText || "");
    }
  });
}
