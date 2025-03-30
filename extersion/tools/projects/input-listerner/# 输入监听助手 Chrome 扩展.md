# 输入监听助手 Chrome 扩展

一个智能的输入框自动补全扩展，支持中文输入智能补全和鼠标事件监听。

## 功能特性

- 实时监听页面上的输入框和可编辑区域
- 智能中文输入补全（基于DeepSeek API）
- 鼠标悬停、点击等事件跟踪
- 支持普通input和contenteditable元素

## 安装方法

1. 克隆本仓库
2. 在Chrome浏览器中打开 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"，选择本项目的`extersion/tools/projects/input-listerner`目录

## 配置说明

1. 需要配置DeepSeek API密钥：
   - 点击扩展图标
   - 进入选项页面
   - 输入您的API密钥

## 使用说明

1. 在任意网页的输入框中输入中文
2. 当检测到有效输入时，会自动显示补全建议
3. 按Tab键接受建议，按ESC键拒绝建议

## 开发说明

```bash
# 安装依赖
npm install

# 开发构建
npm run dev

# 生产构建 
npm run build