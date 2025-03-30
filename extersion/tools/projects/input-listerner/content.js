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
      if (message.type === 'GET_DEEPSEEK_COMPLETION') {
        console.log('[DeepSeek] 开始API请求，输入内容:', message.text);
        const startTime = Date.now();
        
        fetch(DEEPSEEK_CONFIG.API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_CONFIG.API_KEY}`
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
        .then(response => {
          console.log('[DeepSeek] 收到API响应，状态码:', response.status);
          return response.json();
        })
        .then(data => {
          console.log('[DeepSeek] API调用成功，耗时:', Date.now() - startTime + 'ms');
          console.log('[DeepSeek] 返回的完整响应数据:', JSON.stringify(data, null, 2));
          
          if (data.choices && data.choices[0] && data.choices[0].message) {
            const suggestion = data.choices[0].message.content;
            console.log('[DeepSeek] 提取的建议内容:', suggestion);
            resolve({suggestion: {value: suggestion}});
          } else {
            console.warn('[DeepSeek] 响应数据格式不符合预期');
            resolve(null);
          }
        })
        .catch(error => {
          console.error('[DeepSeek] API调用失败:', error);
          console.log('[DeepSeek] 失败耗时:', Date.now() - startTime + 'ms');
          resolve(null);
        });
      } 
      // 修改chrome API调用部分
      else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
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
    });
  }

  function setupInputListeners() {
    // 添加标记属性防止重复监听
    const inputs = document.querySelectorAll('input, textarea, [contenteditable]:not([data-autocomplete-bound])');
    
    inputs.forEach(input => {
      // 标记已绑定的元素
      input.dataset.autocompleteBound = 'true';
      
      // 修改所有 chrome.runtime.sendMessage 调用处
      input.addEventListener('mouseenter', (e) => {
        if (typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'MOUSE_EVENT',
            event: 'enter',
            element: e.target.tagName,
            id: e.target.id || '无ID'
          });
        }
      });
      
      // 鼠标离开事件
      input.addEventListener('mouseleave', (e) => {
        if (typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'MOUSE_EVENT',
            event: 'leave',
            element: e.target.tagName,
            id: e.target.id || '无ID'
          });
        }
      });
      
      // 点击事件
      if (!input.__clickHandler) {
        input.__clickHandler = (e) => {
          sendRuntimeMessage({
            type: 'ICON_COLOR',
            color: 'yellow'
          });
          if (typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
              type: 'MOUSE_EVENT',
              event: 'click',
              element: e.target.tagName,
              id: e.target.id || '无ID'
            });
          }
        };
        input.addEventListener('click', input.__clickHandler);
      }
      
      // 输入事件监听
      if (!input.__inputHandler) {
        // 修改输入事件处理部分
        // 在输入处理部分增加日志
        // 修改输入事件监听部分
        input.__inputHandler = debounce(async (e) => {
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
  
          if (!localResponse?.suggestion?.value) {
            console.log('[AutoComplete] 本地规则未匹配，尝试DeepSeek API');
            const deepseekResponse = await sendRuntimeMessage({
              type: 'GET_DEEPSEEK_COMPLETION',
              text: currentValue
            });
            
            // 修改补全建议的显示逻辑
            if (deepseekResponse?.suggestion?.value) {
              console.log('[AutoComplete] 获得DeepSeek建议:', deepseekResponse.suggestion.value);
              const suggestion = deepseekResponse.suggestion.value;
              
              if (suggestion) {
                // 对于普通输入框
                if (!inputElement.isContentEditable) {
                  const cursorPos = inputElement.selectionStart;
                  
                  // 直接修改输入框值，将建议内容追加到当前输入后面
                  inputElement.value = currentValue + suggestion;
                  // 设置选中状态，只选中补全部分
                  inputElement.setSelectionRange(
                    currentValue.length,
                    currentValue.length + suggestion.length
                  );
                  
                  // 高亮显示补全部分为灰色
                  const style = document.createElement('style');
                  style.textContent = `
                    input::selection, textarea::selection {
                      background-color: #f0f0f0;
                      color: #999;
                    }
                  `;
                  document.head.appendChild(style);
                  
                  // 处理键盘事件
                  const handleKeyDown = (e) => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      // 确认补全，光标移动到补全内容末尾
                      inputElement.setSelectionRange(
                        currentValue.length + suggestion.length,
                        currentValue.length + suggestion.length
                      );
                    } else if (e.key === 'Backspace') {
                      e.preventDefault(); // 阻止默认的退格行为
                      // 仅删除补全部分，保留用户原有输入
                      inputElement.value = currentValue;
                      inputElement.setSelectionRange(
                        currentValue.length,
                        currentValue.length
                      );
                    } else {
                      // 其他按键移除补全
                      inputElement.value = currentValue;
                      inputElement.setSelectionRange(
                        currentValue.length,
                        currentValue.length
                      );
                    }
                    // 移除样式
                    document.head.removeChild(style);
                    inputElement.removeEventListener('keydown', handleKeyDown);
                  };
                  
                  inputElement.addEventListener('keydown', handleKeyDown, {once: true});
                }
                // 对于contenteditable元素保持原有逻辑
                else {
                  // 创建补全提示元素
                  const suggestionEl = document.createElement('span');
                  suggestionEl.className = 'autocomplete-suggestion';
                  suggestionEl.textContent = suggestionText;
                  suggestionEl.style.color = '#999';
                  suggestionEl.style.backgroundColor = 'transparent';
                  suggestionEl.style.padding = '0 2px';
                  
                  // 获取当前光标位置
                  if (inputElement.isContentEditable) {
                    // 对于contenteditable元素
                    const selection = window.getSelection();
                    const range = selection.getRangeAt(0);
                    range.collapse(false);
                    
                    // 创建临时span来标记光标位置
                    const tempSpan = document.createElement('span');
                    tempSpan.id = 'temp-cursor-marker';
                    range.insertNode(tempSpan);
                    
                    // 在临时span后插入补全建议
                    tempSpan.parentNode.insertBefore(suggestionEl, tempSpan.nextSibling);
                    
                    // 移除临时span
                    tempSpan.remove();
                  } else {
                    // 对于普通输入框
                    const cursorPos = inputElement.selectionStart;
                    const beforeText = currentValue.substring(0, cursorPos);
                    const afterText = currentValue.substring(cursorPos);
                    
                    // 更新输入框值，在光标位置插入补全建议
                    inputElement.value = beforeText + afterText;
                    inputElement.setSelectionRange(cursorPos, cursorPos);
                    
                    // 创建并插入补全建议元素
                    const wrapper = document.createElement('div');
                    wrapper.style.position = 'relative';
                    wrapper.style.display = 'inline-block';
                    
                    // 替换输入框为包装元素
                    inputElement.parentNode.insertBefore(wrapper, inputElement);
                    wrapper.appendChild(inputElement);
                    
                    // 创建并定位补全建议
                    const suggestionEl = document.createElement('span');
                    suggestionEl.className = 'autocomplete-suggestion';
                    suggestionEl.textContent = suggestionText;
                    suggestionEl.style.position = 'absolute';
                    suggestionEl.style.left = `${inputElement.offsetWidth}px`;
                    suggestionEl.style.top = '0';
                    suggestionEl.style.color = '#999';
                    
                    wrapper.appendChild(suggestionEl);
                  }
                  
                  // 只保留Tab键确认功能
                  const handleKeyDown = (e) => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      // 仅追加补全部分，不覆盖原有内容
                      if (inputElement.isContentEditable) {
                        inputElement.textContent = currentValue + suggestionText;
                      } else {
                        inputElement.value = currentValue + suggestionText;
                      }
                      suggestionEl.remove();
                    } else {
                      suggestionEl.remove();
                    }
                  };
                  
                  inputElement.addEventListener('keydown', handleKeyDown, {once: true});
                }
              }
            }
          }
        }, 2000); // 从500ms增加到1000ms
  
        // 新增获取光标位置函数
        function getCursorPosition(input) {
          const rect = input.getBoundingClientRect();
          const style = window.getComputedStyle(input);
          const lineHeight = parseInt(style.lineHeight);
          return {
            left: rect.left + input.selectionStart * 8, // 近似计算
            top: rect.top + (lineHeight || 20)
          };
        }
        input.addEventListener('input', input.__inputHandler);
      }
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
}

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