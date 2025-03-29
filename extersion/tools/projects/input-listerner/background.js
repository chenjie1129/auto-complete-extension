// 添加图标颜色设置函数
function setIconColor(color) {
  const path = {
    red: 'icons/red-icon.png',
    yellow: 'icons/yellow-icon.png',
    gray: 'icons/gray-icon.png'
  };
  chrome.action.setIcon({ path: path[color] });
}

// 监听消息
// 添加错误处理
// 添加自动补全规则
const autoCompleteRules = {
  '你好': {value: '你好，世界！'},
  '时间': {value: new Date().toLocaleTimeString()},
  '日期': {value: new Date().toLocaleDateString()},
  'http://': {value: 'https://'}
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_AUTOCOMPLETE') {
    const match = Object.keys(autoCompleteRules).find(key => 
      request.text === key || request.text.startsWith(key)
    );
    sendResponse(match ? {suggestion: autoCompleteRules[match]} : null);
  }
  try {
    console.log('收到消息:', request);
    // 处理消息逻辑...
    sendResponse({success: true});
  } catch (error) {
    console.error('处理消息时出错:', error);
    sendResponse({success: false, error: error.message});
  }
  return true; // 保持消息端口开放
});

// 初始化为灰色图标
setIconColor('gray');