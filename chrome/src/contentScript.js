'use strict';

// Content script file will run in the context of web page.
// With content script you can manipulate the web pages using
// Document Object Model (DOM).
// You can also pass information to the parent extension.

// We execute this script by making an entry in manifest.json file
// under `content_scripts` property

// For more information on Content Scripts,
// See https://developer.chrome.com/extensions/content_scripts
// Check if danbooru
const danbooru =
  document.URL.includes('danbooru') && document.URL.includes('posts');

if (danbooru) {
  function getFilename() {
    if (!danbooru) return null;
    const characterSegment = document.querySelectorAll('.character-tag-list');
    let charNameList;
    for (const [idx, value] of characterSegment.entries()) {
      if (value.tagName == 'UL') {
        charNameList = characterSegment[idx].children;
        break;
      }
    }
    const charNames = [];

    if (charNameList) {
      for (const listItem of charNameList) {
        charNames.push(
          listItem.querySelector('.search-tag').innerHTML.replace(' ', '')
        );
      }
    }

    const postID = document.querySelector('#post-info-id').innerHTML.split(' ');

    const charNameComplex = charNames.reduce(
      (complex, characterName) => complex + characterName,
      ''
    );

    return `${charNameComplex}-${postID[1]}`;
  }

  chrome.runtime.sendMessage({ danbooru, filename: getFilename() });
}
