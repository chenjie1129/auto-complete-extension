// 修改为使用条件执行而不是直接return
if (!chrome?.runtime?.sendMessage) {
  console.error('Chrome扩展API不可用，请检查manifest配置');
  // 可以在这里禁用所有扩展功能
  // 或者提供降级方案
} else {
  // 原有的事件监听代码放在这里
  // 在文件顶部添加DeepSeek配置
  // 在文件顶部添加（放在DEEPSEEK_CONFIG下面）
  const LOCAL_RULES = {
    NAME_TO_ID: {
      'chenjie': '1129'
    },
    COMMON_PHRASES: {},
    COMMANDS: {}
  };
  
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
        // 清理输入文本
        message.text = cleanEditorText(message.text);
        
        console.log('[DeepSeek] 清理后的输入内容:', message.text);
        chrome.storage.sync.get(['deepseekApiKey'], (result) => {
          const apiKey = result.deepseekApiKey || DEEPSEEK_CONFIG.API_KEY;
          if (!apiKey) {
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
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: DEEPSEEK_CONFIG.MODEL,
              messages: [{
                role: 'user',
                content: `请忽略所有文档格式和元数据信息，仅根据用户实际输入的中文内容提供补全建议。当前输入内容：${message.text}。只需返回补全部分，不要解释或添加其他内容。`
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
      } else if (message.type === 'GET_AUTOCOMPLETE') {
      // 检查所有本地规则
      const text = message.text.toLowerCase().trim(); // 添加trim()确保去除空格
      
      // 1. 检查精确匹配
      if (LOCAL_RULES.NAME_TO_ID[text]) {
        resolve({suggestion: {value: LOCAL_RULES.NAME_TO_ID[text]}});
        return;
      }
      
      // 2. 检查包含匹配（原逻辑）
      const nameMatch = Object.entries(LOCAL_RULES.NAME_TO_ID).find(([key]) => 
      text.includes(key.toLowerCase())
      );
      if (nameMatch) {
      resolve({suggestion: {value: nameMatch[1]}});
      return;
      }
      
      // 2. 检查常用短语
      const phraseMatch = Object.entries(LOCAL_RULES.COMMON_PHRASES).find(([key]) => 
      text.endsWith(key.toLowerCase())
      );
      if (phraseMatch) {
      resolve({suggestion: {value: phraseMatch[1]}});
      return;
      }
      
      // 3. 检查快捷命令
      const commandMatch = Object.entries(LOCAL_RULES.COMMANDS).find(([key]) => 
      text.startsWith(key.toLowerCase())
      );
      if (commandMatch) {
      resolve({suggestion: {value: commandMatch[1]}});
      return;
      }
      
      // 没有匹配的本地规则
      sendChromeMessage();
    } else {
      sendChromeMessage();
    }
  }); // 确保Promise闭合
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
  const isFeishuDoc = FeishuAdapter.isFeishuDocument();
  
  if (isFeishuDoc && EXTENSION_CONFIG.adaptFeishu) {
    FeishuAdapter.applyStyles();
  }
  
  const inputs = document.querySelectorAll('input, textarea, [contenteditable]:not([data-autocomplete-bound])');
  
  inputs.forEach(input => {
    if (input.__autocompleteBound) return;
    input.__autocompleteBound = true;
    input.__isFeishu = isFeishuDoc;
    
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
      if (hasPendingSuggestion) return;
      
      const inputElement = e.target;
      // 改进文本提取逻辑 - 新增富文本编辑器特殊处理
      let currentValue = '';
      if (inputElement.isContentEditable) {
        // 对于富文本编辑器，获取当前光标位置的文本段落
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const paragraph = range.startContainer.parentElement.closest('p,div,span');
          currentValue = paragraph?.textContent || inputElement.textContent || '';
        } else {
          currentValue = inputElement.textContent || '';
        }
      } else {
        currentValue = inputElement.value;
      }
      
      // 增强文本清理逻辑
      currentValue = cleanEditorText(currentValue);
      
      // 移除所有非文本字符和多余空格
      currentValue = currentValue
        .replace(/[\u200b-\u200f\u202a-\u202e]/g, '') // 移除零宽字符
        .replace(/\s+/g, ' ') // 合并多个空格
        .trim();
      
      // 移除旧的建议（如果存在）
      const oldSuggestion = inputElement.nextElementSibling;
      if (oldSuggestion?.classList.contains('autocomplete-suggestion')) {
        oldSuggestion.remove();
      }
      
      // 检查是否有实际输入变化且包含中文且不是标点符号
      // 修改检测逻辑，只允许中文内容触发补全
      if (!currentValue || 
          typeof currentValue !== 'string' ||
          currentValue === inputElement.__lastValue || 
          !containsChinese(currentValue) ||  // 只允许包含中文的内容
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
    }, 2000); // 修改为等待2秒才开始补全检测
    
    // Tab键处理逻辑 - 已正确移动到这里
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && hasPendingSuggestion) {
        e.preventDefault();
        confirmCompletion(input);
        setTimeout(() => {
          const focusable = [...document.querySelectorAll('input, button, a, [tabindex]')];
          const currentIndex = focusable.indexOf(input);
          const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
          if (focusable[nextIndex]) {
            focusable[nextIndex].focus();
          }
        }, 50);
      }
    });

    input.addEventListener('input', input.__inputHandler);
    input.addEventListener('blur', () => {
      hasPendingSuggestion = false;
      delete input.__currentSuggestion;
    });
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
// 中文检测函数
function containsChinese(text) {
  return /[\u4e00-\u9fa5]/.test(text);
}

// 添加showCompletion函数
// 修改showCompletion函数中的cleanup逻辑
function showCompletion(inputElement, currentValue, suggestion) {
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
    // contenteditable元素处理 - 飞书文档特殊处理
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // 使用适配器处理飞书文档
      if (inputElement.__isFeishu && EXTENSION_CONFIG.adaptFeishu) {
        if (FeishuAdapter.insertSuggestion(inputElement, range, suggestion)) {
          return;
        }
      }

      // 普通contenteditable处理
      const cursorPosition = range.startOffset;
      const textNode = range.startContainer;
      
      if (textNode.nodeType === Node.TEXT_NODE) {
        textNode.data = textNode.data.slice(0, cursorPosition) + 
                      suggestion + 
                      textNode.data.slice(cursorPosition);
        range.setStart(textNode, cursorPosition + suggestion.length);
        range.collapse(true);
      }
    }
  }

  const handleInput = (e) => {
    const newValue = inputElement.isContentEditable ? inputElement.textContent : inputElement.value;
    // 如果新输入的内容不再包含建议内容，则清理建议
    if (!newValue.includes(suggestion)) {
      cleanup();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      
      // 统一处理Tab键确认逻辑
      const confirmAndMoveFocus = () => {
        // 保存当前输入框状态
        const wasContentEditable = inputElement.isContentEditable;
        const originalValue = wasContentEditable ? inputElement.textContent : inputElement.value;
        
        // 执行补全确认
        if (wasContentEditable) {
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const cursorPosition = range.startOffset;
            const textNode = range.startContainer;
            
            if (textNode.nodeType === Node.TEXT_NODE) {
              textNode.data = textNode.data.slice(0, cursorPosition) + 
                            suggestion + 
                            textNode.data.slice(cursorPosition);
              range.setStart(textNode, cursorPosition + suggestion.length);
              range.collapse(true);
            }
          }
        } else {
          const startPos = inputElement.selectionStart;
          inputElement.value = currentValue + suggestion;
          inputElement.setSelectionRange(
            startPos + suggestion.length,
            startPos + suggestion.length
          );
        }
        
        // 清理补全状态
        cleanup();
        
        // 延迟执行焦点转移，确保DOM更新完成
        setTimeout(() => {
          const focusable = [...document.querySelectorAll('input, textarea, [contenteditable], button, a, [tabindex]')];
          const currentIndex = focusable.indexOf(inputElement);
          const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
          
          if (focusable[nextIndex]) {
            focusable[nextIndex].focus();
            // 确保新获得焦点的元素正确处理选择状态
            if (focusable[nextIndex].isContentEditable) {
              const range = document.createRange();
              range.selectNodeContents(focusable[nextIndex]);
              range.collapse(true);
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }
        }, 50);
      };
      
      confirmAndMoveFocus();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
      if (inputElement.isContentEditable) {
        inputElement.textContent = currentValue;
      } else {
        inputElement.value = currentValue;
        inputElement.setSelectionRange(currentValue.length, currentValue.length);
      }
      inputElement.__lastValue = currentValue;
    } else if (e.key === 'Backspace') {
      // 处理退格键
      const currentText = inputElement.isContentEditable ? inputElement.textContent : inputElement.value;
      if (currentText.endsWith(suggestion)) {
        e.preventDefault();
        if (inputElement.isContentEditable) {
          inputElement.textContent = currentValue;
          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(inputElement);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          inputElement.value = currentValue;
          inputElement.setSelectionRange(currentValue.length, currentValue.length);
        }
        cleanup();
        inputElement.__lastValue = currentValue;
      }
    }
  };

  function cleanup() {
    hasPendingSuggestion = false;
    // 只移除建议元素，不影响原有内容
    if (suggestionEl && suggestionEl.parentNode) {
      suggestionEl.remove();
    }
    if (!inputElement.isContentEditable && style && style.parentNode === document.head) {
      document.head.removeChild(style);
    }
    inputElement.removeEventListener('keydown', handleKeyDown);
    inputElement.removeEventListener('input', handleInput);
  }
  
  inputElement.addEventListener('keydown', handleKeyDown, {once: false});
  inputElement.addEventListener('input', handleInput, {once: false});  // 新增：监听input事件
}

// 新增文本清理函数
function cleanEditorText(text) {
  if (!text) return '';
  
  // 移除常见的文档元数据标记
  const metadataPatterns = [
    /Add Icon/g,
    /Add Cover/g,
    /Modified (Today|\d{4}-\d{2}-\d{2})/g,
    /Created by .* on .*/g,
    /[A-Z][a-z]+\s[A-Z][a-z]+/g // 匹配英文姓名格式
  ];
  
  // 应用所有清理规则
  let cleaned = text;
  metadataPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // 保留原有清理逻辑
  return cleaned
    .replace(/[\u200b-\u200f\u202a-\u202e]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCompletion(text) {
  const prompt = `你是一位资深产品经理，请从专业的产品设计角度考虑，为以下输入提供最合适的自动补全建议：
  要求：
  1. 保持专业性和实用性
  2. 考虑用户体验和产品逻辑
  3. 提供简洁明了的补全内容
  
  当前输入内容：${text}`;

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'GET_DEEPSEEK_COMPLETION',
      text: prompt
    }, (response) => {
      resolve(response?.suggestion);
    });
  });
}


// 添加全局配置对象
const EXTENSION_CONFIG = {
  adaptFeishu: false, // 默认不启用飞书适配
  // ...其他配置项
};

// 从存储中加载配置
chrome.storage.sync.get(['extensionConfig'], (result) => {
  if (result.extensionConfig) {
    Object.assign(EXTENSION_CONFIG, result.extensionConfig);
  }
});


// 飞书文档适配工具函数
const FeishuAdapter = {
  // 检测是否是飞书文档
  isFeishuDocument: () => {
    return EXTENSION_CONFIG.adaptFeishu && 
           document.querySelector('.lark-editor, .feishu-doc') !== null;
  },

  // 应用飞书特殊样式
  applyStyles: () => {
    const style = document.createElement('style');
    style.textContent = `
      .autocomplete-suggestion {
        color: #999 !important;
        background-color: transparent !important;
      }
    `;
    document.head.appendChild(style);
    return style;
  },

  // 飞书文档特殊处理插入逻辑
  insertSuggestion: (inputElement, range, suggestion) => {
    const paragraph = range.startContainer.parentElement.closest('p,div,span');
    if (!paragraph) return false;

    const textNode = document.createTextNode(suggestion);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    
    const event = new Event('input', { bubbles: true });
    inputElement.dispatchEvent(event);
    return true;
  }
}; // 确保对象定义以分号结尾
}