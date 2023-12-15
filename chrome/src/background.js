'use strict';
const storageCache = {};
async function initStorageCache() {
  chrome.storage.sync.get().then((items) => {
    // Copy the data retrieved from storage into storageCache.
    Object.assign(storageCache, items);
  });
}

async function getTabId() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab.id;
}

function getFilename() {
  const characterSegment = document.querySelectorAll('.character-tag-list');
  let charNameList;
  for (const [idx, value] of characterSegment.entries()) {
    if (value.tagName == 'UL') {
      charNameList = characterSegment[idx].children;
      break;
    }
  }
  const listItemNames = [];

  for (const listItem of charNameList) {
    listItemNames.push(
      listItem.querySelector('.search-tag').innerHTML.replace(/ /gm, '')
    );
  }

  const charNames = [];
  let name;

  for (let i = 0; i < listItemNames.length; i++) {
    const nextName = listItemNames[i];
    if (name && nextName.includes(name)) {
      continue;
    }
    // Remove parentheses descriptors from names
    name = nextName.split('(')[0];
    charNames.push(name);
  }

  const postID = document.querySelector('#post-info-id').innerHTML.split(' ');

  const charNameComplex = charNames.reduce(
    (complex, characterName) => complex + characterName,
    ''
  );

  return `${charNameComplex}-${postID[1]}`;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'imagedownloader70013910',
    title: 'Pre-filled image save',
    contexts: ['image'],
  });
});

// const messageListener = chrome.runtime.onMessage.addListener((message) => {
//   console.log(message);
//   console.log(message.danbooru);
//   if (message.danbooru) {
//     storageCache.newFilename = message.filename;
//     console.log(storageCache);
//   }
// });

chrome.downloads.onDeterminingFilename.addListener((downloadItem, _suggest) => {
  console.log(JSON.stringify(downloadItem));
  async function suggest() {
    // Load settings
    try {
      await initStorageCache();
      // await messageListener;
      await chrome.scripting
        .executeScript({
          target: { tabId: await getTabId() },
          func: getFilename,
        })
        .then((result) => {
          storageCache.newFilename = result[0]['result'];
        });
    } catch (error) {
      console.log('Error loading settings');
      return false;
    }
    // Get from settings
    const subdir = storageCache.subdirectory || 'danboorareru';
    const newFilename = storageCache.newFilename;
    console.log(storageCache);
    _suggest({
      filename: `${subdir}/${newFilename || downloadItem.filename}.png`,
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
