// 修改为使用条件执行而不是直接return
if (!chrome?.runtime?.sendMessage) {
  console.error('Chrome扩展API不可用，请检查manifest配置');
  // 可以在这里禁用所有扩展功能
  // 或者提供降级方案
} else {
  // 原有的事件监听代码放在这里
  // 在文件顶部添加DeepSeek配置
  const DEEPSEEK_CONFIG = {
    API_ENDPOINT: 'https://api.deepseek.com/v1/chat/completions',
    API_KEY: 'sk-6ab99f1c54b943ce8f30f038c9c426fc', // 请替换为实际API密钥
    MODEL: 'deepseek-chat',
    TEMPERATURE: 0.7
  };
  
  // 修改sendRuntimeMessage函数，增加DeepSeek支持
  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      const sendChromeMessage = () => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          try {
            chrome.runtime.sendMessage(message, resolve);
          } catch (error) {
            console.error('发送chrome.runtime消息失败:', error);
            resolve(null);
          }
        } else {
          console.warn('chrome.runtime API不可用，消息未发送:', message.type);
          resolve(null);
        }
      };
  
      if (message.type === 'GET_DEEPSEEK_COMPLETION') {
        chrome.storage.sync.get(['deepseekApiKey'], (result) => {
          if (!result.deepseekApiKey) {
            console.error('未配置DeepSeek API Key');
            resolve(null);
            return;
          }
  
          console.log('[DeepSeek] 开始API请求，输入内容:', message.text);
          const startTime = Date.now();
          
          fetch(DEEPSEEK_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${result.deepseekApiKey}`
            },
            body: JSON.stringify({
              model: DEEPSEEK_CONFIG.MODEL,
              messages: [{
                role: 'user',
                content: `请根据以下中文输入内容，提供最可能的自动补全建议，只需返回补全部分，不要解释或添加其他内容。输入内容：${message.text}`
              }],
              temperature: DEEPSEEK_CONFIG.TEMPERATURE
            })
          })
          .then(response => response.json())
          .then(data => {
            if (data.choices?.[0]?.message) {
              resolve({suggestion: {value: data.choices[0].message.content}});
            } else {
              resolve(null);
            }
          })
          .catch(error => {
            console.error('[DeepSeek] API调用失败:', error);
            resolve(null);
          });
        });
      } else {
        sendChromeMessage();
      }
    });
  }
}

function createMouseEventMessage(event, target) {
  return {
    type: 'MOUSE_EVENT',
    event: event,
    element: target.tagName,
    id: target.id || '无ID'
  };
}

// 在文件顶部添加全局状态变量
let hasPendingSuggestion = false;

function setupInputListeners() {
  const inputs = document.querySelectorAll('input, textarea, [contenteditable]:not([data-autocomplete-bound])');
  
  inputs.forEach(input => {
    if (input.__autocompleteBound) return;
    input.__autocompleteBound = true;
    
    // 统一事件处理
    const handleEvent = (type, e) => {
      if (chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage(createMouseEventMessage(type, e));
      }
    };
    
    ['mouseenter', 'mouseleave', 'click'].forEach(event => {
      input.addEventListener(event, (e) => {
        if (event === 'click') {
          sendRuntimeMessage({type: 'ICON_COLOR', color: 'yellow'});
        }
        handleEvent(event, e);
      });
    });

    // 输入事件处理
    input.__inputHandler = debounce(async (e) => {
      if (hasPendingSuggestion) {
        return; // 有未处理的补全建议时直接返回
      }
      
      const inputElement = e.target;
      // 处理contenteditable和普通输入框
      const currentValue = inputElement.isContentEditable ? 
                          inputElement.textContent : 
                          inputElement.value;
      
      // 移除旧的建议（如果存在）
      const oldSuggestion = inputElement.nextElementSibling;
      if (oldSuggestion?.classList.contains('autocomplete-suggestion')) {
        oldSuggestion.remove();
      }
      
      // 检查是否有实际输入变化且包含中文且不是标点符号
      if (!currentValue || 
          typeof currentValue !== 'string' ||
          currentValue === inputElement.__lastValue || 
          !containsChinese(currentValue) ||
          /[，。、；：？！""''《》【】\s]/.test(currentValue.slice(-1))) {
        return;
      }
      
      inputElement.__lastValue = currentValue;
  
      // 优先尝试本地规则，失败后尝试DeepSeek
      const localResponse = await sendRuntimeMessage({
        type: 'GET_AUTOCOMPLETE',
        text: currentValue
      });
  
      if (!localResponse?.suggestion?.value && !hasPendingSuggestion) {
        console.log('[AutoComplete] 本地规则未匹配，尝试DeepSeek API');
        const deepseekResponse = await sendRuntimeMessage({
          type: 'GET_DEEPSEEK_COMPLETION',
          text: currentValue
        });
        
        if (deepseekResponse?.suggestion?.value) {
          console.log('[DeepSeek] 收到补全建议:', deepseekResponse.suggestion.value);
          showCompletion(e.target, currentValue, deepseekResponse.suggestion.value);
        }
      }
    }, 1000);
    
    input.addEventListener('input', input.__inputHandler);
  });
}

// 页面加载监听代码
if (document.readyState === 'complete') {
  setupInputListeners();
} else {
  window.addEventListener('load', setupInputListeners);
}

// MutationObserver代码
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      setupInputListeners();
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});


// 防抖函数
function debounce(func, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

// 新增中文检测函数
function containsChinese(text) {
  return /[\u4e00-\u9fa5]/.test(text);
}

// 添加showCompletion函数
// 修改showCompletion函数中的cleanup逻辑
function showCompletion(inputElement, currentValue, suggestion) {
  hasPendingSuggestion = true;
  
  // 打印DeepSeek建议内容
  console.log('[DeepSeek] 自动补全建议:', suggestion);
  
  // 移除旧的建议
  const oldSuggestion = inputElement.nextElementSibling;
  if (oldSuggestion?.classList.contains('autocomplete-suggestion')) {
    oldSuggestion.remove();
  }

  const suggestionEl = document.createElement('span');
  suggestionEl.className = 'autocomplete-suggestion';
  suggestionEl.textContent = suggestion;
  suggestionEl.style.color = '#999';

  let style;
  
  if (!inputElement.isContentEditable) {
    // 普通输入框处理
    inputElement.value = currentValue + suggestion;
    inputElement.setSelectionRange(currentValue.length, currentValue.length + suggestion.length);
    
    style = document.createElement('style');
    style.textContent = `input::selection, textarea::selection { background-color: #f0f0f0; color: #999; }`;
    document.head.appendChild(style);
  } else {
    // contenteditable元素处理
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    range.collapse(false);
    range.insertNode(suggestionEl);
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (inputElement.isContentEditable) {
        inputElement.textContent = currentValue + suggestion;
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(inputElement);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        inputElement.value = currentValue + suggestion;
        inputElement.setSelectionRange(
          currentValue.length + suggestion.length,
          currentValue.length + suggestion.length
        );
      }
      cleanup();
      inputElement.__lastValue = inputElement.isContentEditable ? inputElement.textContent : inputElement.value; // 更新最后记录的值
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
      if (inputElement.isContentEditable) {
        inputElement.textContent = currentValue;
      } else {
        inputElement.value = currentValue;
        inputElement.setSelectionRange(currentValue.length, currentValue.length);
      }
      inputElement.__lastValue = currentValue; // 重置最后记录的值
    }
  };

  function cleanup() {
    hasPendingSuggestion = false;
    suggestionEl.remove();
    if (!inputElement.isContentEditable && style) {
      document.head.removeChild(style);
    }
    inputElement.removeEventListener('keydown', handleKeyDown);
  }
  
  inputElement.addEventListener('keydown', handleKeyDown, {once: false});
}