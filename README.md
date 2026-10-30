# 串口助手

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/HsomeYang.serial-assistant?style=flat-square&label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=HsomeYang.serial-assistant)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/HsomeYang.serial-assistant?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=HsomeYang.serial-assistant)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/HsomeYang.serial-assistant?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=HsomeYang.serial-assistant)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-%E2%89%A5%201.75-007ACC?style=flat-square)](package.json)

在 VS Code 底部面板里调试串口的工具。支持串口直连与 TCP 网络连接，中文不乱码，HEX 收发、时间戳、日志保存一应俱全。

相比独立的串口助手软件，它不占额外窗口——改完代码按 `Ctrl+J` 就能看设备输出。

## 功能特性

**连接**

- 串口直连，或连接远端 TCP（ESP32 的 WiFi 日志、串口服务器）
- 串口参数全配：波特率（15 个预设 + 自定义）、数据位、停止位、校验位、流控制
- DTR / RTS 手动控制，可触发 MCU 复位或进入下载模式
- 断线重连：设备抖动或意外断开时按原参数自动重试，无需重新点开始监视

**中文与编码**

- UTF-8 / GB18030 / Latin1 可选
- **增量解码**：多字节字符被分包截断也能正确还原，不会出现半个汉字
- `GB18030` 是 GBK / GB2312 的超集，简体中文设备选它即可

**收发**

- ASCII 文本与十六进制双向切换，切换后历史内容立即重绘
- 发送可追加行尾符（无 / LF / CR / CRLF）
- 转义符解析：`\r` `\n` `\t` `\xNN`
- 循环发送，周期可设
- RX / TX 字节计数，可清零

**显示**

- 时间戳精确到毫秒，带收/发标记，导出日志后仍能区分方向
- 自动滚动开关，便于翻看历史
- 接收内容一键保存为 txt / log

## 安装

| 环境 | 方式 |
|---|---|
| VS Code 商店 | 扩展视图搜索「串口助手」，或直接打开 [商店页面](https://marketplace.visualstudio.com/items?itemName=HsomeYang.serial-assistant) |
| VSIX 离线安装 | `code --install-extension serial-assistant-0.1.0.vsix` |
| TRAE / CodeBuddy | 扩展视图 → 右上角 `...` → 「从 VSIX 安装...」 |
| 其他 VS Code 衍生 IDE | 同上 |

安装后重载窗口（`Ctrl+Shift+P` → `Developer: Reload Window`）。

## 扩展信息

| 项 | 值 |
|---|---|
| 扩展 ID | `HsomeYang.serial-assistant` |
| 当前版本 | 0.1.0 |
| 运行环境 | VS Code 1.75 及以上 |
| 许可 | MIT（派生自 Microsoft vscode-serial-monitor） |
| 源码仓库 | [HsomeYang/serial-assistant](https://github.com/HsomeYang/serial-assistant) |
| 问题反馈 | [Issues](https://github.com/HsomeYang/serial-assistant/issues) |

## 快速开始

1. 点状态栏右侧的「串口助手」，或 `Ctrl+Shift+P` 搜索「打开串口助手面板」
2. 面板出现在**底部面板区**，与「问题 / 输出 / 调试控制台 / 终端」并列
3. 选择串口与波特率，点「开始监视」
4. 在底部输入框输入内容，回车发送

## 界面说明

```
第一行  串口/TCP │ 端口 刷新 │ 波特率 │ 编码选择 │ 开始监视 │ 状态
第二行  接收模式 │ 时间戳 自动滚动 显示发送 │ 统计 │ 清零 │ 断线重连 清空 保存日志
第三行  输入框 │ 发送 │ 发送模式 │ 解析转义 │ 循环发送 周期
```

**更多设置**：默认收起，点击后展开数据位、停止位、校验位、流控制、DTR/RTS、行尾符这些不常用参数。

**切换按钮**：`接收 [ASCII 文本]`、`时间戳`、`显示发送` 等是点击切换，高亮表示开启；关闭状态的按钮文字带删除线。

## 使用技巧

| 需求 | 做法 |
|---|---|
| 发送换行而不发送内容 | `Shift + 回车` |
| 发送 AT 指令 | 更多设置里把「行尾」设为 CRLF，输入 `AT` 后回车 |
| 用列表外的波特率 | 波特率下拉选「自定义…」，旁边出现输入框 |
| 看原始字节 | 点「接收 [ASCII 文本]」切到「十六进制」 |
| 中文乱码 | 编码下拉切换到 `GB18030` 或 `UTF-8` |

## TCP 模式

点第一行最左的「串口」按钮切到「TCP」，端口下拉会换成 IP 和端口两个输入框。

适用于：

- ESP32 / ESP8266 开 TCP Server 输出日志
- 串口服务器（USR-TCP232、ESP-Link）转发的串口数据
- 远程设备网络控制台

注意：TCP 模式只做**客户端**（主动连接），不做监听服务端，断线后需手动重连。

## 兼容性

| 环境 | 支持 |
|---|---|
| VS Code 1.75 及以上 | 完全支持 |
| TRAE | 支持 |
| CodeBuddy | 支持 |
| VSCodium / Cursor 等衍生 IDE | 支持 |
| 内核低于 1.75 | 不支持 |

扩展只使用标准扩展 API，不依赖市场专有能力。用到的接口与最低版本：

| 接口 | 最低版本 | 用途 |
|---|---|---|
| `WebviewViewProvider` | 1.49 | 底部面板视图 |
| `viewsContainers.panel` | 1.50 | 与终端并列的 Tab |
| `workspace.fs` | 1.37 | 保存日志 |
| `showSaveDialog` | 1.24 | 选择保存路径 |

串口驱动 `serialport` 13 使用 N-API 预编译二进制，与 Node / Electron 版本解耦，无需针对不同 IDE 重新编译；TCP 模式使用 Node 内置 `net` 模块，无额外依赖。

> 若某个 IDE 从商店搜不到本扩展，说明它使用 Open VSX 而非微软市场，需手动安装 vsix。

## 开发调试

```powershell
npm install
npm run build      # lint + 编译
npm run compile    # 仅编译，供 F5 调试
npm run package    # 生成 vsix
npm run publish    # 发布到商店（需 VSCE_PAT 环境变量）
```

在 VS Code / TRAE / CodeBuddy 中打开本目录，按 `F5` 启动扩展宿主调试（配置见 `.vscode/launch.json`）。

### 仓库结构

```
串口助手/
├─ src/
│  ├─ extension.ts      激活入口：视图、命令、状态栏
│  ├─ monitorPanel.ts   底部面板 Webview（界面与消息处理）
│  ├─ serialManager.ts  串口收发与增量解码
│  └─ tcpManager.ts     TCP 客户端连接
├─ api.ts               对外 API 契约（尚未导出 getApi）
├─ resources/           扩展图标
├─ docs/                开发备忘
├─ dist/                编译产物（打包时由 tsc 生成）
├─ package.json         扩展清单
└─ .github/             Issue / PR 模板与 CI 工作流
```

### 发布流程

1. 更新 `package.json` 的 `version` 与 `CHANGELOG.md`
2. 提交并打标签：`git tag v0.1.0 && git push --tags`
3. 标签触发 [publish 工作流](.github/workflows/publish.yml)：打包 vsix、创建 GitHub Release，并在配置了 `VSCE_PAT` 密钥时自动发布到商店
4. 手动发布：`npx vsce publish`

## 已知限制

- 暂无历史发送记录与快捷指令
- 暂无文件发送（X/YMODEM）
- HEX 接收按数据包显示，不保证与物理帧边界对齐
- TCP 断线后需手动重连

## 常见问题

> 端口列表是空的。

先确认设备已被系统识别（设备管理器里能看到 COM 口）。若设备管理器中无对应端口，通常是 USB 转串口驱动未安装（CH340、CP2102 等）。

> 打开串口提示「拒绝访问」。

端口被其他程序占用。关闭其他串口工具（包括另一个窗口里的本扩展）后重试。

> 能打开串口但完全收不到数据。

大概率是流控制选错。设备不支持硬件流控时选了「硬件 RTS/CTS」，会导致一个字节都发不出去——改成「无流控」。

> 选了 1.5 停止位报错。

部分 USB 转串口芯片不支持 1.5 停止位，属硬件限制。

> 1500000 波特率下数据错乱。

CH340 / CP2102 等芯片本身跑不了这么高，降到 921600 或 460800 试试。

> 看不到 ESP8266 的启动日志。

上电瞬间输出的是 74880 波特率，固件启动后才切到 115200。波特率选 74880 才能看到完整启动信息。

## 公开 API

扩展 ID 为 `HsomeYang.serial-assistant`。`0.1.x` 的 `activate()` 尚未导出 `getApi`，第三方扩展调用需等后续版本，契约定义见仓库根目录 `api.ts`。

## 反馈

问题请提交至 [Issues](https://github.com/HsomeYang/serial-assistant/issues)。安全漏洞请勿公开提交，改走 [安全公告](https://github.com/HsomeYang/serial-assistant/security/advisories/new)，详见 [SECURITY.md](SECURITY.md)。

## 许可与来源

本项目派生自 Microsoft 的 [vscode-serial-monitor](https://github.com/microsoft/vscode-serial-monitor)（MIT），
保留原始版权声明与 MIT 许可条款，见 [LICENSE](LICENSE)。

## 商标

本项目可能包含项目、产品或服务的商标或徽标。对 Microsoft 商标或徽标的授权使用须遵循
[Microsoft 商标与品牌指南](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general)。
在修改版本中使用 Microsoft 商标或徽标不得造成混淆或暗示 Microsoft 的赞助。
任何第三方商标或徽标的使用均须遵循第三方的相应政策。
