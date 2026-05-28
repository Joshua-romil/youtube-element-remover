# Youtube Element Remover

A lightweight Chrome extension for hiding distracting YouTube interface elements.

## Current Behavior

- Hides selected items from the YouTube guide/sidebar using CSS.

## Planned Changes

- Hide recommended videos in the right-side panel on video watch pages.
- Hide front-page video grids, including Shorts sections.

## Local Development

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Refresh YouTube after making changes.

## Project Structure

- `manifest.json`: Chrome extension manifest.
- `styles.css`: CSS injected into YouTube pages.
- `hello.html` and `scripts/popup.js`: starter extension files.
