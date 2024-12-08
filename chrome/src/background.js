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

function getFilepath(storageTags) {
  function findTagList(className) {
    const segment = document.querySelectorAll(className);
    let tagList;
    for (const [idx, value] of segment.entries()) {
      if (value.tagName == 'UL') {
        tagList = segment[idx].children;
        break;
      }
    }
    return tagList;
  }
  function findPresentTags(tagList, targetTags) {
    let output = '';

    function formatTagNameToDirName(tag) {
      return tag.replaceAll(':', '');
    }
    for (const listItem of tagList) {
      const tagString = listItem.querySelector('.search-tag').innerHTML;
      if (targetTags.includes(tagString))
        output += formatTagNameToDirName(tagString);
    }
    return output;
  }

  const savedTags = storageTags ?? [];
  const generals = [];
  const artists = [];
  const copyrights = [];
  const characters = [];
  const metas = [];
  savedTags.forEach((item) => {
    switch (item.charAt(0)) {
      case '0':
        generals.push(item.substr(2));
        break;
      case '1':
        artists.push(item.substr(2));
        break;
      case '3':
        copyrights.push(item.substr(2));
        break;
      case '4':
        characters.push(item.substr(2));
        break;
      case '5':
        metas.push(item.substr(2));
        break;
    }
  });
  let subdir = '';
  // Arranged as per how Danbooru displays them
  // If no character names are found at all, name by artists
  const artistList = findTagList('.artist-tag-list');
  if (artists.length > 0) {
    subdir += findPresentTags(artistList, artists);
  }
  if (copyrights.length > 0) {
    const copyrightList = findTagList('.copyright-tag-list');
    subdir += findPresentTags(copyrightList, copyrights);
  }
  if (characters.length > 0) {
    const characterList = findTagList('.character-tag-list');
    subdir += findPresentTags(characterList, characters);
  }
  if (generals.length > 0) {
    const generalList = findTagList('.general-tag-list');
    subdir += findPresentTags(generalList, generals);
  }
  if (metas.length > 0) {
    const metaList = findTagList('.meta-tag-list');
    subdir += findPresentTags(metaList, metas);
  }

  // For now, combining filepath and subdir into 1 method
  let charNameList = findTagList('.character-tag-list');
  const listItemNames = [];
  if (!charNameList || charNameList?.length <= 0) {
    charNameList = artistList;
  }
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

  return `${subdir == '' ? subdir : subdir + '/'}${charNameComplex}-${
    postID[1]
  }`;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'imagedownloader70013910',
    title: 'Pre-filled image save',
    contexts: ['image'],
  });
});

// Initialize preferences on page load
chrome.webNavigation.onCompleted.addListener((details) => {
  initStorageCache();
});

chrome.downloads.onDeterminingFilename.addListener((downloadItem, _suggest) => {
  if (downloadItem.byExtensionName != 'Danboorareru') {
    return false;
  }
  console.log(JSON.stringify(downloadItem));
  async function suggest() {
    // Load settings
    try {
      // Redudnant but just in case
      await initStorageCache();
      // await messageListener;
      await chrome.scripting
        .executeScript({
          target: { tabId: await getTabId() },
          func: getFilepath,
          args: [storageCache.savedTags],
        })
        .then((result) => {
          storageCache.newFilename = result[0]['result'];
        });
    } catch (error) {
      console.error('Error loading settings');
      console.log(error.message);
      return false;
    }
    // Get from settings
    const subdir = storageCache.subdirectory || 'danboorareru';
    const newFilename = storageCache.newFilename;
    _suggest({
      filename: `${subdir}/${newFilename || downloadItem.filename}.png`,
      conflictAction: 'prompt',
    });
  }
  suggest();
  return true;
});

chrome.contextMenus.onClicked.addListener((item, tab) => {
  console.log('Context item', JSON.stringify(item));
  // Needed to access downloadItem to get original filename as fallback
  if (item.menuItemId == 'imagedownloader70013910') {
    console.log('Storage Cache check', storageCache);
    if (storageCache.preferences?.saveOriginal) {
      fetch(item.pageUrl.split('?', 1)[0] + '.json').then(async (response) => {
        const postJson = await response.json();
        // console.log('Post JSON: ', postJson);
        const url = postJson.file_url ?? postJson.large_file_url ?? item.srcUrl;
        chrome.downloads.download({
          url,
          conflictAction: 'prompt',
        });
      });
    } else {
      chrome.downloads.download({
        url: item.srcUrl,
        conflictAction: 'prompt',
      });
    }
  }
});

// For saveas?
