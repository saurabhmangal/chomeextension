# E-Commerce Product Comparator Chrome Extension

This Chrome extension allows you to compare products from multiple open tabs on e-commerce websites. It uses Google's Gemini AI to determine if products are in the same category and thus comparable, then generates a CSV file for comparison.

## Features

- Automatically detects product pages in open tabs
- Extracts product information (name, category, price, etc.)
- Uses AI to check if products are comparable (same category)
- Generates a CSV file with comparable products for easy comparison

## Setup

1. Clone or download this repository.
2. Obtain a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey).
3. Replace `'YOUR_GEMINI_API_KEY'` in `background.js` with your actual API key.
4. Create icon files in the `icons/` folder:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)
5. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension folder

## Usage

1. Open multiple product pages from e-commerce websites in different tabs.
2. Click the extension icon in the Chrome toolbar.
3. Click "Scan Product Tabs" to detect products.
4. Select the products you want to compare.
5. Click "Compare Selected & Generate CSV".
6. The extension will use AI to find comparable products and download a CSV file.

## Supported Sites

The extension attempts to extract product information from any website using common selectors and structured data (JSON-LD). It works best on well-structured e-commerce sites like Amazon, eBay, etc.

## API Key Security

For production use, consider storing the API key securely using Chrome storage or prompting the user to enter it.

## License

MIT License