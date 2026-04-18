# YT-Marker

A lightweight Chrome extension to manually manage your YouTube viewing history.

## 🌟 Features
* **Manual Toggle**: Mark/unmark videos as "Watched" with a custom button or right-click menu.
* **Visual Feedback**: Automatically dim and grayscale watched video thumbnails in lists.
* **Persistent Storage**: Uses **IndexedDB** for fast, reliable, and large-scale data storage.
* **Performance Optimized**: Built with `MutationObserver` and debouncing for smooth browsing.

## 🚀 Installation
1. Clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable "Developer mode".
4. Click "Load unpacked" and select the project folder.

## 🛠️ Tech Stack
* JavaScript (ES6+)
* Chrome Extension API (Manifest V3)
* IndexedDB