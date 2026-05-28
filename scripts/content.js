const STORAGE_KEY = "hideDistractions";
const HIDE_CLASS = "yter-hide-distractions";

function applyVisibility(enabled) {
  document.documentElement.classList.toggle(HIDE_CLASS, enabled);
}

chrome.storage.sync.get({ [STORAGE_KEY]: true }, (settings) => {
  applyVisibility(Boolean(settings[STORAGE_KEY]));
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes[STORAGE_KEY]) return;
  applyVisibility(Boolean(changes[STORAGE_KEY].newValue));
});
