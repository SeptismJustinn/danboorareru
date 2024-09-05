'use strict';

import './options.css';

const storageCache = {};

const saveOriginalPreferencesCheckbox = document.querySelector(
  '#save-original-pref'
);

function mapPreferences(pref) {
  saveOriginalPreferencesCheckbox.checked = pref?.saveOriginal ?? false;
}

function toggleSwitch(value, key) {
  storageCache[key] = value;
  const updatedPref = {};
  updatedPref[key] = value;
  chrome.storage.sync.set({ preferences: updatedPref });
}

saveOriginalPreferencesCheckbox.addEventListener('change', (e) =>
  toggleSwitch(e.target.checked, 'saveOriginal')
);

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

function addTag(tag) {
  const savedTags = storageCache.savedTags ?? [];
  savedTags.push(tag);
  storageCache.savedTags = savedTags;
  chrome.storage.sync.set({ savedTags });
  mapSavedTags(savedTags);
}

function removeTag(tag) {
  const savedTags = storageCache.savedTags.filter((item) => item != tag);
  storageCache.savedTags = savedTags;
  chrome.storage.sync.set({
    savedTags,
  });
  mapSavedTags(savedTags);
}

function mapSavedTags(savedTags) {
  optionsSavedTags.innerHTML = '';
  savedTags.forEach((tag) => {
    const [tagCat, tagName] = tag.split(':');
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

function restoreOptions() {
  chrome.storage.sync.get(null).then((items) => {
    Object.assign(storageCache, items);
    console.log(items);
    const preferences = items.preferences;
    mapPreferences(preferences);
    const savedTags = items.savedTags;
    mapSavedTags(savedTags);
  });
}

async function searchTag(event) {
  event.preventDefault();
  tagSearchSubmit.disabled = true;
  if (tagSearchInput.value == '') {
    tagSearchOutput.innerHTML = '<li class="warning-text">Input empty!</li>';
  } else {
    const tags = await fetch(
      `https://danbooru.donmai.us/tags.json?search[name_matches]=${tagSearchInput.value}`
    ).then((res) => res.json());

    tagSearchOutput.innerHTML = '';
    tags.forEach((res) => {
      if (res.is_deprecated) return;
      const listItem = document.createElement('li');
      listItem.innerHTML = `${categories[res.category]}: ${res.name}</span>, ${
        res.post_count
      } posts. <input type="button" class="add-tag-button" value="+" />`;
      listItem
        .querySelector('.add-tag-button')
        .addEventListener('click', () =>
          addTag(`${res.category}:${res.name.replaceAll('_', ' ')}`)
        );
      tagSearchOutput.appendChild(listItem);
    });
  }
  setTimeout(() => (tagSearchSubmit.disabled = false), 500);
}

document.addEventListener('DOMContentLoaded', restoreOptions);
tagSearchSubmit.addEventListener('click', searchTag);
