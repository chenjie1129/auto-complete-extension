// 确保在保存API Key时也保存飞书适配设置
document.getElementById('save').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value;
  const adaptFeishu = document.getElementById('adaptFeishu').checked;
  
  chrome.storage.sync.set({
    deepseekApiKey: apiKey,
    extensionConfig: {
      adaptFeishu: adaptFeishu
    }
  }, () => {
    // 显示保存成功状态
    const status = document.getElementById('status');
    status.textContent = '设置已保存！';
    status.className = 'success';
    setTimeout(() => status.textContent = '', 2000);
  });
});

// 加载保存的API Key
chrome.storage.sync.get(['deepseekApiKey'], (result) => {
  if (result.deepseekApiKey) {
    document.getElementById('apiKey').value = result.deepseekApiKey;
  }
});

// 显示/隐藏API Key
document.getElementById('toggleKey').addEventListener('change', (e) => {
  const apiKeyInput = document.getElementById('apiKey');
  apiKeyInput.type = e.target.checked ? 'text' : 'password';
});