const STORAGE_KEY = "hideDistractions";
const toggle = document.querySelector("#toggle");
const statusText = document.querySelector("#statusText");
const stateLabel = document.querySelector("#stateLabel");

function render(enabled) {
  toggle.checked = enabled;
  stateLabel.textContent = enabled ? "On" : "Off";
  statusText.textContent = enabled
    ? "Recommendations, Shorts, and homepage videos are hidden."
    : "YouTube is visible again.";
}

chrome.storage.sync.get({ [STORAGE_KEY]: true }, (settings) => {
  render(Boolean(settings[STORAGE_KEY]));
});

toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.sync.set({ [STORAGE_KEY]: enabled }, () => {
    render(enabled);
  });
});
