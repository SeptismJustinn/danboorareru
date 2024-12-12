'use strict';

import './options.css';

// ========== Static/Scriptwide values ==========

const storageCache = {};

/**
 * Definition of a saved tag in savedTags[]:
 * 1.0.0 - "category_id:category_name"
 * 2.0.0 - {category:category_id,
 *          name:category_name,
 *          designation:custom_folder_name,
 *          version:savedTag_version}
 */
const savedTag_version = '2.0.0';

// https://danbooru.donmai.us/wiki_pages/api%3Atags
const categories = [
  '<span class="cat-general">General',
  '<span class="cat-artist">Artist',
  '<span>Category Not Found',
  '<span class="cat-copyright">Copyright',
  '<span class="cat-character">Character',
  '<span class="cat-meta">Meta',
];

// Tag container elements
const tagSearchInput = document.querySelector('#tag-search-input');
const tagSearchSubmit = document.querySelector('#tag-search-submit');
const tagSearchOutput = document.querySelector('#tag-search-output');
const optionsSavedTags = document.querySelector('#options-saved-tags');

const saveOriginalPreferencesCheckbox = document.querySelector(
  '#save-original-pref'
);

// ========== End of static/scriptwide values ==========

// ========== Custom Classes ==========
class TagError extends Error {}
// ========== End of Custom Classes ==========

function mapPreferences(pref) {
  saveOriginalPreferencesCheckbox.checked = pref?.saveOriginal ?? false;
}

function toggleSwitch(value, key) {
  storageCache[key] = value;
  const updatedPref = {};
  updatedPref[key] = value;
  chrome.storage.sync.set({ preferences: updatedPref });
}

function createTag(category, name) {
  const tag = {
    category: category,
    name: formatTagName(name),
    designation: formatTagNameForDirectory(name),
    version: savedTag_version,
  };
  return tag;
}

function addTag(tag) {
  const savedTags = storageCache.savedTags ?? [];
  savedTags.push(tag);
  storageCache.savedTags = savedTags;
  chrome.storage.sync.set({ savedTags });
  mapSavedTags(savedTags);
}

function removeTag(tag) {
  // If removing becomes problematic, may need to consider adding UUIDs or IDs to savedtags
  const savedTags = storageCache.savedTags.filter(
    (item) => item?.name != tag.name
  );
  storageCache.savedTags = savedTags;
  chrome.storage.sync.set({
    savedTags,
  });
  mapSavedTags(savedTags);
}

/**
 * Update this method on version change to select which mapSavedTags to use
 * @param {*} args
 * @returns
 */
function mapSavedTags(args) {
  return _mapSavedTags_2_0_0(args);
}

/**
 * SavedTags 1.0.0 version, expects an array of strings in the 1.0.0 savedTag format
 *
 * 2.0.0 onwards: new versions should TRY to account for or replace old tags with new ones
 * @param {string[]} savedTags
 */
function _mapSavedTags_1_0_0(savedTags) {
  optionsSavedTags.innerHTML = '';
  savedTags.forEach((tag) => {
    const tagSplit = tag.split(':');
    const tagCat = tagSplit[0];
    // Join back excess splits
    const tagName = tagSplit.slice(1).join(':');
    const listItem = document.createElement('li');
    listItem.innerHTML = `${
      categories[parseInt(tagCat)]
    }: ${tagName}</span> <input type="button" class="remove-tag-button" value="-" />`;
    listItem
      .querySelector('.remove-tag-button')
      .addEventListener('click', () => removeTag(tag));
    optionsSavedTags.appendChild(listItem);
  });
}

/**
 * SavedTags 2.0.0 version, expects an array of objects in the 2.0.0 savedTag format:
 * {category:category_id,
 *  name:category_name,
 *  designation:custom_folder_name,
 *  version:savedTag_version}
 * @param {Object[]} savedTags
 */
function _mapSavedTags_2_0_0(savedTags) {
  optionsSavedTags.innerHTML = '';

  savedTags.forEach((tag) => {
    if (!tag?.version) {
      // Strict version checking should really be done in mapSavedTags. This is here mostly to catch error/v1 tags.
      throw new TagError(tag);
    }
    const { category, name, designation } = tag;
    const listItem = document.createElement('li');
    listItem.className = 'tag-list-item';
    listItem.innerHTML = `${
      categories[parseInt(category)]
    }: ${name}</span> <input type="button" class="remove-tag-button" value="Remove" />`;
    listItem
      .querySelector('.remove-tag-button')
      .addEventListener('click', () => removeTag(tag));
    optionsSavedTags.appendChild(listItem);
  });
}

/**
 * Method to handle savedTag types that are not expected in this version
 * @param {any[]} legacyTags
 */
function _mapErrorTags(savedTags) {
  const newSavedTags = [];
  for (const savedTag of savedTags) {
    if (savedTag?.version == savedTag_version) {
      newSavedTags.push(savedTag);
    } else if (typeof savedTag == 'string') {
      try {
        // Only actually need to split by the first string
        const v1Tag = savedTag.split(':');
        newSavedTags.push(createTag(v1Tag[0], v1Tag.slice(1).join(':')));
      } catch (error) {
        console.warn(
          'Breaking-tag encountered, deleting from options...',
          savedTag,
          error
        );
        continue;
      }
    }
    // Remove erroneous tags
  }
  chrome.storage.sync.set({
    savedTags: newSavedTags,
  });
  mapSavedTags(newSavedTags);
}

function restoreOptions() {
  chrome.storage.sync.get(null).then((items) => {
    Object.assign(storageCache, items);
    const preferences = items.preferences;
    mapPreferences(preferences);
    const savedTags = items.savedTags;
    console.log(savedTags);
    try {
      mapSavedTags(savedTags);
    } catch (error) {
      console.warn(
        'Error initializing tags, removing erroneous/old tags\n',
        error
      );
      _mapErrorTags(savedTags);
    }
  });
}

function formatTagName(tag) {
  let result = tag.replaceAll('_', ' ');
  return result;
}

function formatTagNameForDirectory(tag) {
  // ['\\', '/', ':', '*', '?', '"', '<', '>', '|']
  let result = tag.replaceAll(/[\/\\:*?"<>]/g, '').replaceAll('_', ' ');
  return result;
}

async function searchTag(event) {
  event.preventDefault();
  tagSearchSubmit.disabled = true;
  if (tagSearchInput.value == '') {
    tagSearchOutput.innerHTML = '<li class="warning-text">Input empty!</li>';
  } else {
    let searchValue = tagSearchInput.value.replaceAll(' ', '_');
    const tags = await fetch(
      `https://danbooru.donmai.us/tags.json?search[name_matches]=${searchValue}`
    ).then((res) => res.json());

    tagSearchOutput.innerHTML = '';
    if (tags.length > 0) {
      tags.forEach((res) => {
        if (res.is_deprecated) return;
        const listItem = document.createElement('li');
        listItem.innerHTML = `${categories[res.category]}: ${
          res.name
        }</span>, ${
          res.post_count
        } posts. <input type="button" class="add-tag-button" value="+" />`;
        listItem
          .querySelector('.add-tag-button')
          .addEventListener('click', () =>
            addTag(createTag(res.category, res.name))
          );
        tagSearchOutput.appendChild(listItem);
      });
    } else {
      tagSearchOutput.innerHTML =
        '<div class=warning-text>Danbooru could not find this term, please enter precise search term (best to copy straight from danbooru)</div>';
    }
  }
  setTimeout(() => (tagSearchSubmit.disabled = false), 500);
}

document.addEventListener('DOMContentLoaded', restoreOptions);
// Activate search button
tagSearchSubmit.addEventListener('click', searchTag);
// Update saveOriginal flag
saveOriginalPreferencesCheckbox.addEventListener('change', (e) =>
  toggleSwitch(e.target.checked, 'saveOriginal')
);
