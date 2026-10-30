# 串口助手

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/HsomeYang.serial-assistant?style=flat-square&label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=HsomeYang.serial-assistant)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-%E2%89%A5%201.75-007ACC?style=flat-square)](package.json)

在 VS Code 底部面板里调试串口。串口直连或 TCP 网络连接，中文不乱码，HEX 收发、时间戳、日志保存都在一个面板里，不占额外窗口——改完代码按 `Ctrl+J` 就能看设备输出。

## 功能

| 分类 | 能力 |
|---|---|
| 连接 | 串口直连 / TCP 客户端；波特率（15 个预设 + 自定义）、数据位、停止位、校验位、流控制全配 |
| 中文 | UTF-8 / GB18030 / Latin1；**增量解码**，多字节字符被分包截断也不会出现半个汉字 |
| 收发 | ASCII 与十六进制双向切换；行尾符（无 / LF / CR / CRLF）；转义 `\r` `\n` `\t` `\xNN`；循环发送；发送回显可隐藏 |
| 显示 | 毫秒级时间戳并标注收发方向；自动滚动；关键字过滤且命中片段标红；保存为 txt / log |
| 稳定性 | DTR / RTS 手动电平；断线自动重连（约 1 分钟）；打开前 5 秒等待设备枚举 |

## 安装

- **商店**：扩展视图搜索「串口助手」，或[打开商店页面](https://marketplace.visualstudio.com/items?itemName=HsomeYang.serial-assistant)
- **VSIX**：`code --install-extension dist/serial-assistant-0.1.0.vsix`；TRAE / CodeBuddy 等衍生 IDE 用「扩展视图 → `...` → 从 VSIX 安装」

装完按 `Ctrl+Shift+P` → `Developer: Reload Window` 重载窗口。

## 使用

1. 点状态栏右侧的「串口助手」，或 `Ctrl+Shift+P` 搜「打开串口助手面板」
2. 选端口与波特率 →「开始监视」；底部输入框回车发送，`Shift+回车` 换行
3. 「更多设置」里是数据位、停止位、校验、流控、DTR/RTS、行尾这些不常用参数

面板按三行排布：连接与开关、接收与过滤、发送。点击式按钮高亮表示开启，关闭时文字带删除线。

| 需求 | 做法 |
|---|---|
| 发 AT 指令 | 「更多设置」把行尾设为 CRLF，输入 `AT` 回车 |
| 只发一个换行 | 清空输入框、行尾选 LF / CRLF 后回车 |
| 列表外的波特率 | 波特率选「自定义…」再填数值 |
| 看原始字节 | 点「接收 [ASCII 文本]」切到「十六进制」 |
| 中文乱码 | 编码切到 `GB18030`（GBK / GB2312 的超集）或 `UTF-8` |
| 只盯某条报文 | 第二行过滤框输入关键字，命中的片段标红，`Esc` 清空；过滤只影响显示，缓存不外丢 |

## TCP 模式

点第一行最左的「串口」按钮切到「TCP」，端口下拉换成 IP + 端口输入框。适合 ESP32 / ESP8266 的 WiFi 日志、串口服务器（USR-TCP232、ESP-Link）转发的数据。只做客户端不做监听，断线后需手动重连。

## 兼容性

VS Code 1.75 及以上，以及 TRAE、CodeBuddy、Cursor、VSCodium 等衍生 IDE（内核 ≥ 1.75）。只用标准扩展 API，不依赖市场专有能力；串口驱动 `serialport` 13 走 N-API 预编译二进制，无需按 IDE 重编。

从商店搜不到时，说明该 IDE 使用 Open VSX 而非微软市场，手动装 vsix 即可。

## 常见问题

| 现象 | 处理 |
|---|---|
| 端口列表为空 | 设备管理器里看不到 COM 口，装 USB 转串口驱动（CH340、CP2102 等） |
| 提示「拒绝访问」 | 端口被占用，关掉其他串口工具（含另一个窗口的本扩展） |
| 能打开但收不到数据 | 多半是流控选错，设备不支持时选「无流控」 |
| 1.5 停止位报错 | 部分 USB 转串口芯片不支持，属硬件限制 |
| 1500000 波特率乱码 | CH340 / CP2102 跑不了这么高，降到 921600 或 460800 |
| 看不到 ESP8266 启动日志 | 上电瞬间是 74880 波特率，选它才能看全 |

## 限制

- 暂无历史发送记录、快捷指令与文件发送（X / YMODEM）
- HEX 按数据包显示，不保证与物理帧边界对齐
- `0.1.x` 的 `activate()` 尚未导出 `getApi`，第三方集成契约见 `src/api.ts`

## 开发

```powershell
npm install
npm run build      # lint + 编译
npm run compile    # 仅编译，供 F5 调试
npm run package    # 生成 dist/serial-assistant-<版本>.vsix
npm run publish    # 发布到商店（需 VSCE_PAT）
```

按 `F5` 启动扩展宿主调试（配置见 `.vscode/launch.json`）。

```
src/
├─ extension.ts      激活入口：视图、命令、状态栏
├─ monitorPanel.ts   底部面板：连接管理、消息处理、状态同步
├─ webviewHtml.ts    面板界面（HTML / CSS / 脚本）
├─ linkBase.ts       串口与 TCP 共用：增量解码、事件分发
├─ serialManager.ts  串口收发
├─ tcpManager.ts     TCP 客户端
└─ api.ts            对外 API 契约（尚未导出实现）
```

发布：更新 `package.json` 的 `version` 与 `CHANGELOG.md` → `git tag v0.1.0 && git push --tags`，标签触发 `publish.yml`（打包、建 Release，配了 `VSCE_PAT` 时同时发布商店）。

## 反馈与许可

扩展 ID `HsomeYang.serial-assistant`，源码在 [HsomeYang/serial-assistant](https://github.com/HsomeYang/serial-assistant)。问题走 [Issues](https://github.com/HsomeYang/serial-assistant/issues)，安全漏洞走 [安全公告](https://github.com/HsomeYang/serial-assistant/security/advisories/new)，请勿公开提交。

本项目派生自 Microsoft 的 [vscode-serial-monitor](https://github.com/microsoft/vscode-serial-monitor)（MIT），保留原始版权与许可条款，见 [LICENSE](LICENSE)。涉及 Microsoft 商标或徽标的使用须遵循 [Microsoft 商标与品牌指南](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general)。
