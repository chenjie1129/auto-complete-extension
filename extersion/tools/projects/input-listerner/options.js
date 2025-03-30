document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const toggleKey = document.getElementById('toggleKey');
  const saveButton = document.getElementById('save');
  const statusDiv = document.getElementById('status');

  // 加载保存的API Key
  chrome.storage.sync.get(['deepseekApiKey'], (result) => {
    apiKeyInput.value = result.deepseekApiKey || '';
  });

  // 切换显示/隐藏API Key
  toggleKey.addEventListener('change', () => {
    apiKeyInput.type = toggleKey.checked ? 'text' : 'password';
  });

  // 保存按钮点击事件
  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      statusDiv.textContent = '请输入有效的API Key';
      statusDiv.style.color = '#ff0000';
      return;
    }

    chrome.storage.sync.set({ deepseekApiKey: apiKey }, () => {
      statusDiv.textContent = 'API Key已保存成功';
      statusDiv.style.color = '#4CAF50';
      
      // 3秒后自动消失
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 3000);
    });
  });
});