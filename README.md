# Input Listener Assistant Chrome Extension

An intelligent input auto-completion extension with Chinese input support and mouse event tracking.

## Features

- Real-time monitoring of input fields and editable areas
- Intelligent Chinese input completion (powered by DeepSeek API)
- Mouse hover, click and other event tracking
- Supports both regular input and contenteditable elements

## Installation

1. Clone this repository
2. Open `chrome://extensions/` in Chrome browser
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `extersion/tools/projects/input-listerner` directory

## Configuration

1. DeepSeek API key required:
   - Click the extension icon
   - Go to options page
   - Enter your API key

## Usage

1. Type Chinese in any webpage input field
2. When valid input is detected, suggestions will appear automatically
3. Press Tab to accept suggestion, ESC to reject

## Development

```bash
# Install dependencies
npm install

# Development build
npm run dev

# Production build
npm run build