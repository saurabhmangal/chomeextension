# Nexus: Page Insight & Wallpapers

A Chrome extension that summarizes web pages using the Gemini AI API and helps you find high-resolution wallpapers.

## Features

- **Page Summarizer** — Instantly summarize any webpage using Google Gemini 2.5 Flash
- **Wallpaper Finder** — Discover and download high-resolution wallpapers
- **Saurabh's Truck Website** — Companion food startup landing page (`index.html`)

## Setup

1. Clone the repository
2. Open `background.js` and replace `YOUR_GEMINI_API_KEY_HERE` with your [Gemini API key](https://aistudio.google.com/app/apikey)
3. Open `chrome://extensions/` in Chrome
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** and select this folder

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Extension configuration (Manifest V3) |
| `background.js` | Service worker — handles Gemini API calls |
| `content.js` | Content script injected into pages |
| `popup.html/css/js` | Extension popup UI |
| `index.html` + `index.css` | Saurabh's Truck food startup website |
| `verify_nexus_api.py` | Script to test Gemini API connectivity |

## Testing the API

Replace the key in `verify_nexus_api.py`, then run:

```bash
python verify_nexus_api.py
```

## Permissions

- `activeTab` — Read current tab content for summarization
- `scripting` — Inject content scripts
- `downloads` — Save wallpapers
- `storage` — Persist user preferences
