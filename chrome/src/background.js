'use strict';
const storageCache = {};
async function initStorageCache() {
  chrome.storage.sync.get().then((items) => {
    // Copy the data retrieved from storage into storageCache.
    Object.assign(storageCache, items);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'imagedownloader70013910',
    title: 'Pre-filled image save',
    contexts: ['image'],
  });
});

chrome.downloads.onDeterminingFilename.addListener((downloadItem, _suggest) => {
  async function suggest() {
    // Load settings
    try {
      await initStorageCache();
    } catch (error) {
      console.log('Error loading settings');
      return false;
    }
    // Get from settings
    const subdir = storageCache.subdirectory || 'danboorareru';
    const newFilename = storageCache.newFilename;

    _suggest({
      filename: `${subdir}/${newFilename || downloadItem.filename}`,
      conflictAction: 'prompt',
    });
  }
  suggest();
  return true;
});

chrome.contextMenus.onClicked.addListener((item, tab) => {
  // throw new Error(JSON.stringify(item));
  // Needed to access downloadItem to get original filename as fallback
  chrome.downloads.download({
    url: item.srcUrl,
    conflictAction: 'prompt',
  });
});

// For saveas?
