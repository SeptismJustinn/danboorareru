'use strict';

import './popup.css';

const buttonOptions = document.querySelector('#button-options');

function navigateOptions(event) {
  event.preventDefault();
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
}

buttonOptions.addEventListener('click', navigateOptions);
