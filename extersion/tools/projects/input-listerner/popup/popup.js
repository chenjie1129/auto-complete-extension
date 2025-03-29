// 在popup.html中添加<div id="debugLog"></div>

chrome.runtime.onMessage.addListener((request) => {
  const log = document.getElementById('debugLog');
  if (request.type === 'MOUSE_EVENT') {
    log.innerHTML += `<p>${new Date().toLocaleTimeString()} - ${request.event} ${request.element}</p>`;
  }
});