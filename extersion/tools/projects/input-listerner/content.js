// 修改为使用条件执行而不是直接return
if (!chrome?.runtime?.sendMessage) {
  console.error('Chrome扩展API不可用，请检查manifest配置');
  // 可以在这里禁用所有扩展功能
  // 或者提供降级方案
} else {
  // 原有的事件监听代码放在这里
  function setupInputListeners() {
    const inputs = document.querySelectorAll('input, textarea, [contenteditable]');
    
    // Move sendRuntimeMessage outside the forEach
    function sendRuntimeMessage(message) {
      return new Promise((resolve) => {
        if (chrome?.runtime?.sendMessage) {
          chrome.runtime.sendMessage(message, resolve);
        } else {
          console.warn('无法发送消息: runtime API不可用');
          resolve(null);
        }
      });
    }

    inputs.forEach(input => {
      input.addEventListener('mouseenter', (e) => {
        chrome.runtime.sendMessage({
          type: 'MOUSE_EVENT',
          event: 'enter',
          element: e.target.tagName,
          id: e.target.id || '无ID'
        });
      });
      
      // 鼠标离开事件
      input.addEventListener('mouseleave', (e) => {
        chrome.runtime.sendMessage({
          type: 'MOUSE_EVENT',
          event: 'leave',
          element: e.target.tagName,
          id: e.target.id || '无ID'
        });
      });
      
      // 点击事件
      input.addEventListener('click', (e) => {
        sendRuntimeMessage({
          type: 'ICON_COLOR',
          color: 'yellow'
        });
        chrome.runtime.sendMessage({
          type: 'MOUSE_EVENT',
          event: 'click',
          element: e.target.tagName,
          id: e.target.id || '无ID'
        });
      });

      // 输入事件监听
      input.addEventListener('input', async (e) => {
        // 移除旧的提示（如果存在）
        const oldTooltip = document.querySelector('.autocomplete-tooltip');
        if (oldTooltip) oldTooltip.remove();
        
        // 确保chrome API可用
        if (!chrome?.runtime?.sendMessage) {
          console.warn('Chrome扩展API不可用');
          return;
        }

        // 原有图标颜色设置
        chrome.runtime.sendMessage({
          type: 'ICON_COLOR',
          color: 'red'
        });
  
        // 在文件顶部添加（只执行一次）
        const style = document.createElement('style');
        style.textContent = `
          .autocomplete-tooltip {
            position: absolute;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 9999;
            font-size: 14px;
          }
          .autocomplete-tooltip button {
            margin: 0 4px;
            padding: 2px 8px;
            cursor: pointer;
          }
        `;
        document.head.appendChild(style);
  
        // 在文件顶部添加状态变量
        let lastCompletion = null;
  
        // 使用防抖减少频繁触发
        let debounceTimer;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const inputElement = e.target;
          const currentValue = inputElement.value;
          
          // 添加空值检查
          if (!currentValue.trim()) return;
  
          // 优化消息发送频率
          const response = await sendRuntimeMessage({
            type: 'GET_AUTOCOMPLETE',
            text: currentValue
          });
  
          if (response?.suggestion?.value) {
            const suggestion = response.suggestion.value;
            
            // 使用requestAnimationFrame优化DOM操作
            requestAnimationFrame(() => {
              inputElement.value = currentValue + suggestion.slice(currentValue.length);
              inputElement.setSelectionRange(currentValue.length, suggestion.length);
              
              // 使用单次事件监听
              const handleKeyDown = (e) => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  inputElement.value = suggestion;
                  inputElement.setSelectionRange(suggestion.length, suggestion.length);
                  inputElement.removeEventListener('keydown', handleKeyDown);
                } else if (e.key !== 'Shift') {
                  inputElement.value = currentValue;
                  inputElement.setSelectionRange(currentValue.length, currentValue.length);
                  inputElement.removeEventListener('keydown', handleKeyDown);
                }
              };
              
              inputElement.addEventListener('keydown', handleKeyDown, {once: true});
            });
          }
        }, 150); // 150ms防抖延迟
      });
  
      // 添加失去焦点事件
      input.addEventListener('blur', (e) => {
        chrome.runtime.sendMessage({
          type: 'ICON_COLOR',
          color: 'gray' // 默认颜色
        });
      });
    });
  }

  // 页面加载监听代码
  if (document.readyState === 'complete') {
    setupInputListeners();
  } else {
    window.addEventListener('load', setupInputListeners);
  }

  // MutationObserver代码保持不变
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