// 添加选项页面逻辑
document.addEventListener('DOMContentLoaded', () => {
  // 加载保存的设置
  chrome.storage.sync.get(['deepseekApiKey', 'extensionConfig'], (result) => {
    const apiKeyInput = document.getElementById('api-key-input');
    if (result.deepseekApiKey) {
      apiKeyInput.value = result.deepseekApiKey;
      document.getElementById('key-status').textContent = 'DeepSeek API 已配置';
    }
    
    // 如果有飞书适配设置也加载
    if (result.extensionConfig?.adaptFeishu !== undefined) {
      document.getElementById('adaptFeishu').checked = result.extensionConfig.adaptFeishu;
    }
  });
  
  // 保存设置
  document.getElementById('save-btn').addEventListener('click', () => {
    const apiKey = document.getElementById('api-key-input').value.trim();
    const adaptFeishu = document.getElementById('adaptFeishu')?.checked || false;
    
    chrome.storage.sync.set({
      deepseekApiKey: apiKey,
      extensionConfig: {
        adaptFeishu: adaptFeishu
      }
    }, () => {
      const status = document.getElementById('key-status');
      status.textContent = '设置已保存！';
      status.className = 'success';
      setTimeout(() => status.textContent = '', 2000);
    });
  });
  
  // API Key显示切换
  document.getElementById('toggleKey').addEventListener('change', (e) => {
    const apiKeyInput = document.getElementById('api-key-input');
    apiKeyInput.type = e.target.checked ? 'text' : 'password';
  });
});