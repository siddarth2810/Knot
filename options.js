const saveAsEl = document.getElementById("saveAs");
chrome.storage.sync.get(["saveAs"], (res) => {
  saveAsEl.checked = !!res.saveAs;
});
saveAsEl.addEventListener("change", () => {
  chrome.storage.sync.set({ saveAs: saveAsEl.checked });
});
