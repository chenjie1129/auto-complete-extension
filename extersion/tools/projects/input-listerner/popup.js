// 更新弹出窗口状态
function updateStatus(event) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = `最新事件: ${event.event} (${event.element} #${event.id})`;
}

// 监听来自后台的消息
chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'MOUSE_EVENT') {
    updateStatus(request);
  }
});