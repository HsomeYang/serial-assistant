// Copyright (c) 2026 HsomeYang.
// Licensed under the MIT License.

import * as crypto from "crypto";

/** Full webview markup: styles and script are inline, allowed by the CSP nonce. */
export function buildWebviewHtml(): string {
  const nonce = crypto.randomBytes(16).toString("base64");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0; padding: 8px; display: flex; flex-direction: column; gap: 8px;
    color: var(--vscode-foreground); background: var(--vscode-panel-background, var(--vscode-editor-background));
    font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); line-height: 1.4;
  }

  /* 工具栏行：自动换行，行高与控件齐平 */
  .bar { display: flex; flex-wrap: wrap; gap: 4px 5px; align-items: center; flex: 0 0 auto; min-height: 24px; }

  /* 功能分组分隔线 */
  .sep {
    flex: 0 0 auto; width: 1px; height: 18px; margin: 0 2px;
    background: var(--vscode-panel-border, var(--vscode-widget-border, rgba(128,128,128,.3)));
  }

  /* 控件统一尺寸与外观 */
  select, input[type="text"], input[type="number"], textarea, button {
    height: 24px; padding: 0 6px; border-radius: 2px; outline: none;
    font-family: inherit; font-size: inherit; line-height: 22px;
    color: var(--vscode-input-foreground); background-color: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
  }
  select {
    color: var(--vscode-dropdown-foreground); background-color: var(--vscode-dropdown-background);
    border-color: var(--vscode-dropdown-border, var(--vscode-input-border, transparent));
  }
  /* 原生下拉列表默认白底浅字，深色主题下几乎看不清 */
  body.vscode-dark select,
  body.vscode-high-contrast select,
  body.vscode-high-contrast-light select { color-scheme: dark; }
  body.vscode-light select { color-scheme: light; }
  select option {
    background-color: var(--vscode-dropdown-background, #3c3c3c);
    color: var(--vscode-dropdown-foreground, #cccccc);
  }
  select:focus, input:focus, button:focus { border-color: var(--vscode-focusBorder); }
  input::placeholder { color: var(--vscode-input-placeholderForeground, var(--vscode-descriptionForeground)); }

  /* 按钮分两级：primary 为主操作，其余为次要操作 */
  button {
    cursor: pointer; white-space: nowrap;
    color: #1f1f1f; background-color: #ffffff;
    border-color: rgba(0, 0, 0, .2);
    transition: background-color .1s ease, transform .06s ease, box-shadow .06s ease;
  }
  button:hover:not(:disabled) { background-color: #e8e8e8; }
  /* 按下反馈：下移 1px + 内凹阴影，模拟物理按压 */
  button:active {
    transform: translateY(1px);
    box-shadow: inset 0 1px 3px var(--vscode-widget-shadow, rgba(0, 0, 0, .45));
  }
  button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
  button:disabled { opacity: .45; cursor: default; }
  button:disabled:active { transform: none; box-shadow: none; }
  /* 主操作靠字重与宽度区分，不再用蓝色填充 */
  button.primary { padding: 0 12px; font-weight: 600; }
  button.toggle { text-align: center; }
  /* 开关关闭态：灰字 + 删除线，与开启态的黑字形成对比 */
  button.toggle:not(.plain):not(.active) {
    color: #8a8a8a;
    text-decoration: line-through;
  }
  /* 模式按钮文字长度不同，固定宽度避免切换时抖动 */
  #viewMode, #sendMode { min-width: 92px; }

  /* 串口 / TCP 模式切换：隐藏与当前模式无关的控件
     用 body:not(...) 提高优先级，避免被后面的 .group { display: inline-flex } 覆盖 */
  body:not(.mode-tcp) .tcp-only { display: none; }
  body.mode-tcp .serial-only { display: none; }
  body.mode-tcp .tcp-only { display: inline-flex; }

  /* 高级参数整行默认隐藏，展开时作为独立一行出现，不挤压上下两行 */
  body:not(.show-advanced) .advanced-row { display: none; }

  /* 「更多设置 / 收起设置」是同一按钮，锁定宽度与伸缩行为，
     保证切换文字时不产生任何位移 */
  #advanced {
    flex: 0 0 auto;
    min-width: 84px;
    text-align: center;
  }
  #tcpHost { flex: 1 1 132px; width: auto; min-width: 120px; max-width: 300px; }
  #tcpPort { width: 64px; }


  /* 标签与控件成组，换行时不拆开 */
  .group { display: inline-flex; align-items: center; gap: 4px; }

  /* 每行的主要操作整体靠右，且不会被拆到两行 */
  .action-group {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
  }
  .tag { color: var(--vscode-descriptionForeground); font-size: 11px; white-space: nowrap; }
  .unit { opacity: .7; }

  /* 端口这一组吸收行内多余空间，右侧按钮左边不会留下大片空白 */
  .group.grow { flex: 1 1 auto; min-width: 0; }
  /* 过滤框吃掉本行剩余宽度，不再留出一段空白 */
  /* 过滤框先用剩余空间，空间不足时优先压缩它，避免把后面的按钮顶到下一行 */
  #filter { flex: 1 1 140px; min-width: 0; max-width: 240px; width: 100%; }
  #port { flex: 1 1 200px; width: auto; min-width: 170px; max-width: 260px; }
  #baud { width: 96px; }
  /* 只有选择「自定义」时才显示输入框 */
  #baudCustom { display: none; width: 78px; }
  #baudCustom.show { display: inline-block; }
  #cycle { width: 66px; }
  /* 单行起步，内容变多时由脚本增高；横向不再滚动，避免滚动条把 24px 高度吃掉 */
  #input {
    flex: 1 1 auto; min-width: 160px;
    height: 24px; min-height: 24px; max-height: 96px;
    line-height: 20px; padding-top: 1px; padding-bottom: 1px;
    resize: none; overflow-x: hidden; overflow-y: auto;
    white-space: pre-wrap; word-break: break-all;
  }
  label { display: inline-flex; gap: 4px; align-items: center; height: 24px; cursor: pointer; user-select: none; white-space: nowrap; }

  /* 连接状态徽章 */
  #status {
    padding: 0 8px; height: 20px; line-height: 18px; border-radius: 10px;
    font-size: 11px; white-space: nowrap;
    /* 未连接时保持低调的灰色，不与两侧按钮抢注意力 */
    color: #8a8a8a;
    background: rgba(128, 128, 128, .16);
    border: 1px solid rgba(128, 128, 128, .3);
  }
  #status.on { color: #fff; background: var(--vscode-testing-iconPassed, #388a34); }
  #status.err { color: var(--vscode-inputValidation-errorForeground, #fff); background: var(--vscode-inputValidation-errorBackground, #5a1d1d); }

  /* 接收区 */
  #output {
    flex: 1 1 auto; min-height: 60px; overflow: auto; padding: 6px 8px;
    border: 1px solid var(--vscode-panel-border, var(--vscode-input-border, transparent));
    border-radius: 2px; background: var(--vscode-editor-background);
    font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size);
    line-height: 1.5; white-space: pre-wrap; word-break: break-all;
  }
  /* 收发方向区分：接收用前景色，发送用绿色 */
  #output .line.rx { color: var(--vscode-foreground); }
  #output .line.tx { color: var(--vscode-terminal-ansiGreen, #4ec9b0); }
  #output .line.tx.failed { color: var(--vscode-errorForeground); }
  #output .line.err { color: var(--vscode-errorForeground); }
  /* 过滤命中片段：红字 + 淡红底，随过滤词实时重绘 */
  #output .line .hit {
    color: var(--vscode-errorForeground, #f14c4c);
    background: rgba(241, 76, 76, .18);
    border-radius: 2px;
  }
  /* 空状态引导 */
  #output:empty::before {
    content: '接收区为空。打开串口后，收到的数据会显示在这里。';
    color: var(--vscode-descriptionForeground); opacity: .55;
    font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);
  }
  /* 过滤后没有命中时给对应提示，而不是「接收区为空」 */
  body.filtering #output:empty::before { content: '没有匹配的内容。'; }

  /* 自绘悬停提示：Webview 中原生 title 不弹出，改用浮层 */
  #tip {
    position: fixed; display: none; z-index: 9999;
    max-width: 320px; padding: 6px 9px;
    font-size: 12px; line-height: 1.55; white-space: pre-line;
    color: var(--vscode-editorHoverWidget-foreground, #cccccc);
    background: var(--vscode-editorHoverWidget-background, #252526);
    border: 1px solid var(--vscode-editorHoverWidget-border, #454545);
    border-radius: 3px;
    box-shadow: 0 2px 8px var(--vscode-widget-shadow, rgba(0, 0, 0, .36));
    pointer-events: none;
  }
</style>
</head>
<body>
  <div class="bar">
    <button id="advanced" class="toggle plain" data-tip="展开或收起不常用参数：数据位、停止位、校验位、流控制、DTR/RTS、行尾符&#10;展开后整行出现在下方，不会挤动本行">更多设置</button>
    <span class="sep"></span>
    <button id="linkMode" class="toggle plain" data-tip="连接方式：串口直连 或 TCP 网络连接&#10;串口 —— USB / 板载串口设备&#10;TCP —— ESP32 的 WiFi 日志、串口服务器、远程设备">串口</button>
    <span class="group serial-only grow">
      <select id="port" data-tip="串口设备列表，每 2 秒自动刷新。选中后点「开始监视」打开。"></select>
    </span>
    <span class="group tcp-only grow">
      <input type="text" id="tcpHost" value="192.168.1.100" data-tip="远端 IP 或主机名，例如 192.168.1.100 或 device.local">
      <input type="text" id="tcpPort" value="8080" data-tip="远端端口号，范围 1~65535">
    </span>
    <span class="sep"></span>
    <span class="group serial-only"><span class="tag">波特率</span>
      <select id="baud" data-tip="波特率：每秒传输的位数，必须与设备设置一致，否则收到乱码或无数据&#10;选「自定义」后可手动输入任意值，例如 31250">
        <option value="300">300</option>
        <option value="1200">1200</option>
        <option value="2400">2400</option>
        <option value="4800">4800</option>
        <option value="9600">9600</option>
        <option value="19200">19200</option>
        <option value="38400">38400</option>
        <option value="57600">57600</option>
        <option value="74880">74880</option>
        <option value="115200" selected>115200</option>
        <option value="230400">230400</option>
        <option value="250000">250000</option>
        <option value="460800">460800</option>
        <option value="921600">921600</option>
        <option value="1500000">1500000</option>
        <option value="custom">自定义…</option>
      </select>
      <input type="text" id="baudCustom" value="115200" placeholder="bps" data-tip="自定义波特率，填正整数，例如 31250、1000000">
    </span>
    <span class="action-group">
      <button id="toggle" class="primary" data-tip="打开或关闭当前选中的串口">开始监视</button>
      <span id="status" data-tip="当前串口连接状态">未连接</span>
    </span>
  </div>

  <div class="bar advanced-row">
    <span class="group serial-only"><span class="tag">数据位</span>
      <select id="dataBits" data-tip="数据位：一个字符由几位二进制表示，绝大多数设备为 8 位">
        <option value="5">5 位</option><option value="6">6 位</option>
        <option value="7">7 位</option><option value="8" selected>8 位</option>
      </select>
    </span>
    <span class="group serial-only"><span class="tag">停止位</span>
      <select id="stopBits" data-tip="停止位：用一个信号位标志一帧数据结束。部分 USB 转串口芯片不支持 1.5 位">
        <option value="1" selected>1 位</option>
        <option value="1.5">1.5 位</option>
        <option value="2">2 位</option>
      </select>
    </span>
    <span class="group serial-only"><span class="tag">校验</span>
      <select id="parity" data-tip="校验位：用于检错。设备未要求时选「无校验」">
        <option value="none" selected>无校验</option>
        <option value="odd">奇校验</option>
        <option value="even">偶校验</option>
        <option value="mark">标记</option>
        <option value="space">空格</option>
      </select>
    </span>
    <span class="group serial-only"><span class="tag">流控</span>
      <select id="flow" data-tip="流控制：设备不支持时必须选「无流控」，否则收不到数据。选硬件流控后 RTS 由驱动接管">
        <option value="none" selected>无流控</option>
        <option value="hardware">硬件 RTS/CTS</option>
        <option value="software">软件 XON/XOFF</option>
      </select>
    </span>
    <span class="sep"></span>
    <button id="reconnect" class="toggle active serial-only" data-tip="断线重连：串口意外断开或设备抖动时，按原参数每 1.5 秒重试一次，最长约 1 分钟&#10;重连成功会提示「已重连」；点「停止监视」不会触发重连">断线重连</button>
    <span class="sep"></span>
    <button id="dtr" class="toggle active serial-only" data-tip="DTR（数据终端就绪）：多数开发板用它触发 MCU 复位&#10;点击切换电平，高亮表示拉高">DTR</button>
    <button id="rts" class="toggle active serial-only" data-tip="RTS（请求发送）：常接 BOOT 引脚，配合 DTR 使 ESP32 等进入下载模式&#10;启用硬件流控时该引脚由驱动接管">RTS</button>
    <span class="sep"></span>
    <span class="group"><span class="tag">行尾</span>
      <select id="ending" data-tip="发送时自动追加的行尾符。发送 AT 指令通常需要 CRLF">
        <option value="none" selected>无</option>
        <option value="lf">LF</option>
        <option value="cr">CR</option>
        <option value="crlf">CRLF</option>
      </select>
    </span>
    <span class="sep"></span>
    <span class="group">
      <span class="tag" data-tip="串口传输的是字节流，需要按编码规则翻译成文字。设备用什么编码发，这里就选什么">编码选择</span>
      <select id="encoding" data-tip="接收数据的解码方式：&#10;UTF-8 —— 现代设备通用（ESP32、Linux、Python）&#10;GB18030 —— 简体中文设备（GBK/GB2312 超集）&#10;Latin1 —— 按原始字节显示，永不出现乱码占位符&#10;中文乱码时在此切换；只影响之后收到的数据">
        <option value="utf-8">UTF-8（通用）</option>
        <option value="gb18030">GB18030（简中）</option>
        <option value="latin1">Latin1（原始字节）</option>
      </select>
    </span>
  </div>

  <div class="bar">
    <span class="group"><span class="tag">接收</span>
      <button id="viewMode" class="toggle plain" data-mode="text" data-tip="点击在「ASCII 文本」与「十六进制」之间切换接收区显示方式&#10;ASCII 文本 —— 按当前编码解码为可读文字&#10;十六进制 —— 显示原始字节，切换后已显示的内容会立即重绘">ASCII 文本</button>
    </span>
    <button id="stamp" class="toggle active" data-tip="在每行数据前加上时刻，并在末尾标注方向&#10;接收：[2026-10-30 17:20:28.422收]&#10;发送：[2026-10-30 17:20:28.422发]&#10;点击开启或关闭，切换后历史内容会立即重绘">时间戳</button>
    <button id="autoScroll" class="toggle active" data-tip="新数据到达时自动滚动到底部&#10;关闭后视图停在当前位置，便于翻看历史">自动滚动</button>
    <button id="showTx" class="toggle active" data-tip="在接收区回显自己发送的内容，用 → 标记，与设备返回的数据区分开&#10;关闭后历史中的发送记录会一并隐藏，记录本身保留">显示发送</button>
    <span class="group grow">
      <input type="text" id="filter" placeholder="过滤接收内容…" data-tip="输入关键字即时过滤接收区，命中的片段会标红；不区分大小写，按 Esc 清空。过滤只影响显示，已缓存的内容不会丢失">
    </span>
    <span class="action-group">
      <button id="clear" data-tip="清空接收区显示与已缓存的日志内容">清空</button>
      <button id="save" data-tip="把当前接收区内容另存为 txt 或 log 文件">保存</button>
    </span>
  </div>

  <div id="output"></div>

  <div class="bar">
    <textarea id="input" rows="1" placeholder="输入要发送到串口的内容，回车发送；Shift+回车换行" data-tip="按回车发送，Shift+回车插入换行而不发送"></textarea>
    <button id="send" class="primary" data-tip="把输入框内容发送到串口">发送</button>
    <button id="sendMode" class="toggle plain" data-mode="text" data-tip="点击在「ASCII 文本」与「十六进制」之间切换发送内容的解析方式&#10;ASCII 文本 —— 按当前编码转为字节&#10;十六进制 —— 每两个字符解析为一个字节，如 E6 B5 8B，字符个数必须为偶数">ASCII 文本</button>
    <button id="escape" class="toggle active" data-tip="启用转义符解析：\\r 回车、\\n 换行、\\t 制表、\\xNN 原始字节，例如 AT\\r\\n&#10;需发送字面反斜杠时写 \\\\ 或关闭该按钮">解析转义</button>
    <button id="loop" class="toggle" data-tip="循环发送：开启后按右侧周期重复发送输入框内容，再次点击即停止">循环发送</button>
    <input type="number" id="cycle" min="100" step="100" value="1000" data-tip="循环发送的间隔，单位毫秒，最小 100">
    <span class="unit">ms</span>
  </div>

<script nonce="${nonce}">
(function () {
  var vscode = acquireVsCodeApi();
  var linkModeEl = document.getElementById('linkMode');
  var advancedEl = document.getElementById('advanced');
  var tcpHostEl = document.getElementById('tcpHost');
  var tcpPortEl = document.getElementById('tcpPort');
  var portEl = document.getElementById('port');
  var baudEl = document.getElementById('baud');
  var baudCustomEl = document.getElementById('baudCustom');
  var dataBitsEl = document.getElementById('dataBits');
  var stopBitsEl = document.getElementById('stopBits');
  var parityEl = document.getElementById('parity');
  var flowEl = document.getElementById('flow');
  var encEl = document.getElementById('encoding');
  var toggleEl = document.getElementById('toggle');
  var statusEl = document.getElementById('status');
  var filterEl = document.getElementById('filter');
  var outputEl = document.getElementById('output');
  var inputEl = document.getElementById('input');
  var sendModeEl = document.getElementById('sendMode');
  var viewModeEl = document.getElementById('viewMode');
  var stampEl = document.getElementById('stamp');
  var autoScrollEl = document.getElementById('autoScroll');
  var showTxEl = document.getElementById('showTx');
  var reconnectEl = document.getElementById('reconnect');
  var escapeEl = document.getElementById('escape');
  var loopEl = document.getElementById('loop');
  var cycleEl = document.getElementById('cycle');
  var endingEl = document.getElementById('ending');
  var dtrEl = document.getElementById('dtr');
  var rtsEl = document.getElementById('rts');
  var sendEl = document.getElementById('send');
  var clearEl = document.getElementById('clear');
  var saveEl = document.getElementById('save');

  var ENDING_MAP = { none: '', lf: '\\n', cr: '\\r', crlf: '\\r\\n' };

  // 长时间高流量接收时防止内存与 DOM 无上限增长
  var MAX_DOM_LINES = 2000;
  var MAX_LOG_LINES = 50000;
  // 面板不可见时 requestAnimationFrame 会停摆，待渲染队列必须设上限，否则内存无限增长
  var MAX_QUEUE = 20000;
  // 每帧最多渲染多少条，避免一次性插入上万节点造成长任务
  var FLUSH_BATCH = 400;

  var isOpen = false;
  var queue = [];
  // 消费游标：用下标推进代替 Array.shift 的整表搬移
  var queueHead = 0;
  var pending = false;
  // 上一次发送的内容，发送失败且输入框已清空时用于回填
  var lastSent = '';
  // 保存原始记录而非格式化字符串，切换显示模式时才能重绘历史内容
  var records = [];
  var loopTimer = null;
  // 打开串口的兜底计时器，防止系统长时间无响应时按钮永久锁死
  var openGuard = null;
  // 连接方式：串口直连 或 TCP
  var linkMode = 'serial';
  // 高级参数是否展开
  var advancedOn = false;

  // 收发两侧当前的显示/解析模式，'text' | 'hex'
  var viewMode = 'text';
  var sendMode = 'text';

  // 切换按钮的状态，替代原来的复选框
  var dtrOn = true;
  var rtsOn = true;
  var autoScrollOn = true;
  var showTxOn = true;
  var reconnectOn = true;
  var escapeOn = true;
  var loopOn = false;
  var stampOn = true;

  function setToggle(el, on) {
    if (on) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  }

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls || '';
  }


  /* 切换按钮的文案与高亮，返回切换后的模式 */
  function toggleMode(el, current) {
    var next = current === 'text' ? 'hex' : 'text';
    el.textContent = next === 'hex' ? '十六进制' : 'ASCII 文本';
    el.setAttribute('data-mode', next);
    if (next === 'hex') {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
    return next;
  }

  /* 一行拆成两段：时间戳前缀（不参与过滤高亮）与正文 */
  function lineParts(rec) {
    var head = fmtStamp(rec.ts, rec.dir) + (rec.dir === 'tx' ? '\\u2192 ' : '\\u2190 ');
    // 没有十六进制数据时（如发送失败）回退显示原始文本
    var body = viewMode === 'hex' && rec.hex ? rec.hex : rec.text;
    if (rec.failed) { body += ' （发送失败）'; }
    return { head: head, body: body };
  }

  /* 纯文本形式，供保存日志使用 */
  function lineText(rec) {
    if (rec.plain) { return rec.text; }
    var parts = lineParts(rec);
    return parts.head + parts.body;
  }

  /* 过滤关键字只作用于显示，原始记录始终保留 */
  var filterText = '';

  function matchesFilter(rec) {
    if (!filterText) { return true; }
    var body = viewMode === 'hex' && rec.hex ? rec.hex : rec.text;
    return !!body && body.toLowerCase().indexOf(filterText) !== -1;
  }

  /* 关闭「显示发送」时发送记录不渲染；有过滤词时只显示命中行 */
  function visible(rec) {
    if (rec.dir === 'tx' && !showTxOn) { return false; }
    return matchesFilter(rec);
  }

  /* 按过滤词把文本切开，命中的片段包进 span.hit 标红 */
  function appendHits(parent, text) {
    if (!filterText || !text) {
      parent.appendChild(document.createTextNode(text || ''));
      return;
    }
    var lower = text.toLowerCase();
    var from = 0;
    for (;;) {
      var at = lower.indexOf(filterText, from);
      if (at < 0) { break; }
      if (at > from) {
        parent.appendChild(document.createTextNode(text.slice(from, at)));
      }
      var hit = document.createElement('span');
      hit.className = 'hit';
      hit.textContent = text.slice(at, at + filterText.length);
      parent.appendChild(hit);
      from = at + filterText.length;
    }
    if (from < text.length) {
      parent.appendChild(document.createTextNode(text.slice(from)));
    }
  }

  function makeNode(rec) {
    var div = document.createElement('div');
    div.className = 'line' + (rec.dir ? ' ' + rec.dir : '') + (rec.failed ? ' failed' : '');
    if (rec.plain) {
      appendHits(div, rec.text);
      return div;
    }
    var parts = lineParts(rec);
    div.appendChild(document.createTextNode(parts.head));
    appendHits(div, parts.body);
    return div;
  }

  function trimDom() {
    var count = outputEl.childElementCount;
    if (count <= MAX_DOM_LINES) { return; }
    for (var i = count - MAX_DOM_LINES; i > 0; i--) {
      outputEl.removeChild(outputEl.firstElementChild);
    }
  }

  function flush() {
    if (pending) { return; }
    pending = true;
    requestAnimationFrame(paint);
  }

  /* 每帧只画一批，积压时继续排下一帧，避免一次插入上万节点卡住界面 */
  function paint() {
    pending = false;
    if (queueHead >= queue.length) {
      queue.length = 0;
      queueHead = 0;
      return;
    }

    var end = Math.min(queue.length, queueHead + FLUSH_BATCH);
    var frag = document.createDocumentFragment();
    for (var i = queueHead; i < end; i++) {
      if (visible(queue[i])) { frag.appendChild(makeNode(queue[i])); }
    }
    queueHead = end;
    outputEl.appendChild(frag);
    trimDom();
    if (autoScrollOn) { outputEl.scrollTop = outputEl.scrollHeight; }

    if (queueHead >= queue.length) {
      queue.length = 0;
      queueHead = 0;
    } else {
      // 已消费的前缀及时丢弃，否则数组本体仍会随积压无限增长
      if (queueHead > 4096) {
        queue = queue.slice(queueHead);
        queueHead = 0;
      }
      flush();
    }
  }

  /* 记录一条数据并裁剪日志缓冲 */
  function pushRecord(rec) {
    records.push(rec);
    // 攒够一批再裁剪，避免每条记录都搬动五万个元素
    if (records.length > MAX_LOG_LINES + 1000) {
      records.splice(0, records.length - MAX_LOG_LINES);
    }
    queue.push(rec);
    if (queue.length - queueHead > MAX_QUEUE) {
      // 界面跟不上（面板不可见时 rAF 会停摆）就丢弃最旧的待渲染记录；
      // 原始记录仍保留在 records 里，切回面板后可重绘、也可保存日志
      queue = queue.slice(queue.length - MAX_QUEUE);
      queueHead = 0;
    }
    flush();
  }

  /* 系统提示行，不带时间戳与方向标记 */
  function notice(text) {
    pushRecord({ plain: true, dir: 'err', text: text });
  }

  /* 全量重绘：从最新一条往前找，最多渲染 MAX_DOM_LINES 行，
     这样开了过滤也能命中较早的记录，而不是只看最近 2000 条 */
  function rebuild() {
    var picked = [];
    for (var i = records.length - 1; i >= 0 && picked.length < MAX_DOM_LINES; i--) {
      if (visible(records[i])) { picked.push(records[i]); }
    }
    var frag = document.createDocumentFragment();
    for (var j = picked.length - 1; j >= 0; j--) {
      frag.appendChild(makeNode(picked[j]));
    }
    outputEl.textContent = '';
    queue.length = 0;
    queueHead = 0;
    outputEl.appendChild(frag);
    if (autoScrollOn) { outputEl.scrollTop = outputEl.scrollHeight; }
  }

  function pad(n, w) {
    var s = String(n);
    while (s.length < w) { s = '0' + s; }
    return s;
  }

  /* 固定格式 [2026-10-30 17:20:28.422发] / [..收]，开关关闭时返回空串 */
  function fmtStamp(ts, dir) {
    if (!stampOn) { return ''; }
    var d = new Date(ts);
    var mark = dir === 'tx' ? '发' : '收';
    return '[' + d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2) +
      ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2) +
      '.' + pad(d.getMilliseconds(), 3) + mark + '] ';
  }

  /* 连接期间锁住连接参数；切换连接方式也锁住，避免状态错乱 */
  function lockPort(enabled) {
    var controls = [portEl, baudEl, baudCustomEl, dataBitsEl, stopBitsEl,
      parityEl, flowEl, tcpHostEl, tcpPortEl, linkModeEl];
    for (var i = 0; i < controls.length; i++) {
      controls[i].disabled = enabled;
    }
  }

  /* 面板关闭后重建的界面是全新默认值，用宿主侧的真实状态回填，
     否则会出现「显示未连接、实际端口开着」「编码显示 UTF-8、实际按 GB18030 解码」这类错位 */
  function applyRemoteState(msg) {
    if (msg.encoding && encEl.value !== msg.encoding) {
      encEl.value = msg.encoding;
    }
    if (typeof msg.dtr === 'boolean' && msg.dtr !== dtrOn) {
      dtrOn = msg.dtr;
      setToggle(dtrEl, dtrOn);
    }
    if (typeof msg.rts === 'boolean' && msg.rts !== rtsOn) {
      rtsOn = msg.rts;
      setToggle(rtsEl, rtsOn);
    }
    if (typeof msg.reconnect === 'boolean' && msg.reconnect !== reconnectOn) {
      reconnectOn = msg.reconnect;
      setToggle(reconnectEl, reconnectOn);
    }
    if (msg.mode && msg.mode !== linkMode) {
      linkMode = msg.mode;
      linkModeEl.textContent = linkMode === 'tcp' ? 'TCP' : '串口';
      applyLinkMode();
    }
  }

  function applyState(msg) {
    isOpen = !!msg.open;
    // 无论成功失败都要解除锁定，否则打开失败后按钮会一直不可点
    if (openGuard) {
      clearTimeout(openGuard);
      openGuard = null;
    }
    applyRemoteState(msg);
    toggleEl.disabled = false;
    toggleEl.textContent = isOpen ? '停止监视' : '开始监视';
    lockPort(isOpen);
    if (isOpen) {
      setStatus('已连接 ' + (msg.path || ''), 'on');
      pushSignals();
    } else {
      // 断开后循环发送没有意义，只会不停产生失败记录
      stopLoop();
      if (statusEl.className === 'err') {
        // 刚报过错误，先让提示停留几秒再回到未连接，避免一闪而过看不到原因
        setTimeout(function () {
          if (!isOpen && statusEl.className === 'err') { setStatus('未连接', ''); }
        }, 4000);
      } else {
        setStatus('未连接', '');
      }
    }
  }

  function pushSignals() {
    if (!isOpen) { return; }
    vscode.postMessage({ type: 'signals', dtr: dtrOn, rts: rtsOn });
  }

  /* 收集当前界面上的串口参数 */
  function currentOptions() {
    // 选「自定义」时取输入框的值，否则取下拉选中项；非法值回退 115200
    var baud = baudEl.value === 'custom' ? Number(baudCustomEl.value) : Number(baudEl.value);
    if (!isFinite(baud) || baud <= 0) { baud = 115200; }

    return {
      mode: linkMode,
      path: portEl.value,
      host: tcpHostEl.value.trim(),
      port: Number(tcpPortEl.value) || 8080,
      baudRate: Math.floor(baud),
      dataBits: Number(dataBitsEl.value),
      stopBits: Number(stopBitsEl.value),
      parity: parityEl.value,
      flow: flowEl.value,
      encoding: encEl.value
    };
  }

  function send(keepInput) {
    var value = inputEl.value;
    var ending = ENDING_MAP[endingEl.value] || '';
    // 内容为空时只允许「只发行尾符」
    if (value.length === 0 && ending === '') { return; }
    if (!isOpen) {
      if (!loopOn) { notice('连接未建立，无法发送'); }
      return;
    }
    lastSent = value;
    vscode.postMessage({
      type: 'send',
      data: value,
      hex: sendMode === 'hex',
      ending: ending,
      escape: escapeOn
    });
    if (!keepInput) {
      inputEl.value = '';
      autoGrow();
    }
  }

  /* 输入框随内容增高：空内容回落到单行，最多约 4 行；面板隐藏时 scrollHeight 可能为 0，钳住下限 */
  function autoGrow() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(96, Math.max(24, inputEl.scrollHeight)) + 'px';
  }

  inputEl.addEventListener('input', autoGrow);

  function updateLoop() {
    if (loopTimer) {
      clearInterval(loopTimer);
      loopTimer = null;
    }
    if (!loopOn) { return; }
    var ms = Math.max(100, Number(cycleEl.value) || 1000);
    loopTimer = setInterval(function () { send(true); }, ms);
  }

  /* 连接断开或发送失败时停掉循环发送，避免每个周期都刷一条失败记录 */
  function stopLoop() {
    if (loopTimer) {
      clearInterval(loopTimer);
      loopTimer = null;
    }
    if (loopOn) {
      loopOn = false;
      setToggle(loopEl, false);
    }
  }

  advancedEl.addEventListener('click', function () {
    advancedOn = !advancedOn;
    document.body.classList.toggle('show-advanced', advancedOn);
    advancedEl.textContent = advancedOn ? '收起设置' : '更多设置';
  });

  /* 串口 / TCP 各自控件的显隐由 CSS 的 .mode-tcp 规则统一控制 */
  function applyLinkMode() {
    document.body.classList.toggle('mode-tcp', linkMode === 'tcp');
  }

  linkModeEl.addEventListener('click', function () {
    linkMode = linkMode === 'serial' ? 'tcp' : 'serial';
    linkModeEl.textContent = linkMode === 'tcp' ? 'TCP' : '串口';
    applyLinkMode();
  });

  // 初始按串口模式应用一次，确保 TCP 专属控件一开始就是隐藏的
  applyLinkMode();

  toggleEl.addEventListener('click', function () {
    if (isOpen) {
      vscode.postMessage({ type: 'close' });
      return;
    }
    if (linkMode === 'tcp') {
      if (!tcpHostEl.value.trim()) {
        notice('请填写远端 IP 或主机名');
        return;
      }
    } else if (!portEl.value) {
      notice('请先选择串口');
      return;
    }

    // 端口不存在或无响应时系统会重试数秒，先给出即时反馈并锁住按钮
    setStatus('正在打开…', '');
    toggleEl.disabled = true;
    if (openGuard) { clearTimeout(openGuard); }
    openGuard = setTimeout(function () {
      openGuard = null;
      toggleEl.disabled = false;
      setStatus('打开超时', 'err');
      notice('打开超时：端口无响应，请检查设备连接或是否被其他程序占用');
    }, 12000);

    vscode.postMessage({ type: 'open', options: currentOptions() });
  });

  encEl.addEventListener('change', function () {
    vscode.postMessage({ type: 'encoding', encoding: encEl.value });
  });

  var filterTimer = null;

  /* 过滤词落地：同步状态、空态提示并重绘 */
  function commitFilter() {
    filterText = filterEl.value.trim().toLowerCase();
    document.body.classList.toggle('filtering', !!filterText);
    rebuild();
  }

  /* 输入时延迟 80ms 再重绘，避免每敲一个字就把五万条记录扫一遍 */
  function applyFilter() {
    if (filterTimer) { clearTimeout(filterTimer); }
    filterTimer = setTimeout(function () {
      filterTimer = null;
      commitFilter();
    }, 80);
  }

  filterEl.addEventListener('input', applyFilter);

  // Esc 快速清空过滤词，立即生效
  filterEl.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      filterEl.value = '';
      if (filterTimer) { clearTimeout(filterTimer); filterTimer = null; }
      commitFilter();
      e.stopPropagation();
    }
  });

  sendEl.addEventListener('click', function () { send(false); });

  setToggle(dtrEl, dtrOn);
  dtrEl.addEventListener('click', function () {
    dtrOn = !dtrOn;
    setToggle(dtrEl, dtrOn);
    pushSignals();
  });

  setToggle(rtsEl, rtsOn);
  rtsEl.addEventListener('click', function () {
    rtsOn = !rtsOn;
    setToggle(rtsEl, rtsOn);
    pushSignals();
  });

  setToggle(loopEl, loopOn);
  loopEl.addEventListener('click', function () {
    loopOn = !loopOn;
    setToggle(loopEl, loopOn);
    updateLoop();
  });

  cycleEl.addEventListener('change', updateLoop);

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(false);
    }
  });

  clearEl.addEventListener('click', function () {
    outputEl.textContent = '';
    records.length = 0;
    queue.length = 0;
    queueHead = 0;
  });

  saveEl.addEventListener('click', function () {
    var lines = [];
    for (var i = 0; i < records.length; i++) {
      if (visible(records[i])) { lines.push(lineText(records[i])); }
    }
    if (lines.length === 0) {
      notice('暂无可保存的接收内容');
      return;
    }
    vscode.postMessage({ type: 'save', content: lines.join('\\n') });
  });

  // 接收模式点击切换后立即重绘历史内容
  viewModeEl.addEventListener('click', function () {
    viewMode = toggleMode(viewModeEl, viewMode);
    rebuild();
  });

  // 发送模式只影响之后的发送，无需重绘
  sendModeEl.addEventListener('click', function () {
    sendMode = toggleMode(sendModeEl, sendMode);
  });

  // 时间戳、回显、自动滚动均为切换按钮，变化后即时反馈
  setToggle(stampEl, stampOn);
  stampEl.addEventListener('click', function () {
    stampOn = !stampOn;
    setToggle(stampEl, stampOn);
    rebuild();
  });

  setToggle(showTxEl, showTxOn);
  showTxEl.addEventListener('click', function () {
    showTxOn = !showTxOn;
    setToggle(showTxEl, showTxOn);
    rebuild();
  });

  // 选择「自定义」才显示输入框，并自动聚焦
  baudEl.addEventListener('change', function () {
    var custom = baudEl.value === 'custom';
    baudCustomEl.classList.toggle('show', custom);
    if (custom) {
      baudCustomEl.focus();
    }
  });

  // 自定义波特率失焦时校正，非法内容回落到 115200
  baudCustomEl.addEventListener('blur', function () {
    var value = Number(baudCustomEl.value);
    if (!isFinite(value) || value <= 0) {
      baudCustomEl.value = '115200';
    } else {
      baudCustomEl.value = String(Math.floor(value));
    }
  });

  setToggle(autoScrollEl, autoScrollOn);
  autoScrollEl.addEventListener('click', function () {
    autoScrollOn = !autoScrollOn;
    setToggle(autoScrollEl, autoScrollOn);
  });

  setToggle(reconnectEl, reconnectOn);
  reconnectEl.addEventListener('click', function () {
    reconnectOn = !reconnectOn;
    setToggle(reconnectEl, reconnectOn);
    vscode.postMessage({ type: 'reconnect', enabled: reconnectOn });
  });

  setToggle(escapeEl, escapeOn);
  escapeEl.addEventListener('click', function () {
    escapeOn = !escapeOn;
    setToggle(escapeEl, escapeOn);
  });

  window.addEventListener('message', function (event) {
    var msg = event.data;
    if (msg.type === 'ports') {
      // 刷新后若原端口仍在列表中则保持选中，避免跳回第一个端口
      var keep = portEl.value;
      portEl.textContent = '';
      if (!msg.ports || msg.ports.length === 0) {
        var empty = document.createElement('option');
        empty.value = '';
        empty.textContent = '未发现串口';
        portEl.appendChild(empty);
      } else {
        var stillThere = false;
        for (var i = 0; i < msg.ports.length; i++) {
          var opt = document.createElement('option');
          opt.value = msg.ports[i].path;
          opt.textContent = msg.ports[i].friendlyName
            ? msg.ports[i].path + ' - ' + msg.ports[i].friendlyName
            : msg.ports[i].path;
          if (opt.value === keep) { stillThere = true; }
          portEl.appendChild(opt);
        }
        if (stillThere) {
          portEl.value = keep;
        } else if (keep) {
          // 原端口已拔出：保留占位项维持选择，点开始监视会进入 5 秒等待
          var gone = document.createElement('option');
          gone.value = keep;
          gone.textContent = keep + '（已断开）';
          portEl.appendChild(gone);
          portEl.value = keep;
        }
      }
    } else if (msg.type === 'state') {
      applyState(msg);
    } else if (msg.type === 'data') {
      pushRecord({ ts: msg.ts, dir: 'rx', text: msg.text, hex: msg.hex });
    } else if (msg.type === 'tx') {
      pushRecord({ ts: msg.ts, dir: 'tx', text: msg.text, hex: msg.hex, failed: msg.ok === false });
      if (msg.ok === false) {
        // 发送失败时把内容放回输入框，避免用户重打
        if (!inputEl.value && lastSent) { inputEl.value = lastSent; }
        if (loopOn) {
          stopLoop();
          notice('循环发送已停止：发送失败');
        }
      }
    } else if (msg.type === 'waiting') {
      setStatus('等待 ' + msg.path + ' …', '');
      notice('等待串口 ' + msg.path + '，最多 5 秒…');
    } else if (msg.type === 'reconnecting') {
      setStatus('重连中…', '');
    } else if (msg.type === 'closed') {
      applyState({ open: false });
      notice('连接已关闭' + (msg.reason ? '：' + msg.reason : ''));
    } else if (msg.type === 'error') {
      setStatus(msg.message, 'err');
      notice(msg.message);
    }
  });

  /* 自绘悬停提示：不受 Webview 对原生 title 的限制，且立即显示 */
  var tipEl = document.createElement('div');
  tipEl.id = 'tip';
  document.body.appendChild(tipEl);

  function showTip(target) {
    var text = target.getAttribute('data-tip');
    if (!text) { return; }
    tipEl.textContent = text;
    tipEl.style.display = 'block';

    var rect = target.getBoundingClientRect();
    var left = rect.left;
    var maxLeft = window.innerWidth - tipEl.offsetWidth - 8;
    if (left > maxLeft) { left = Math.max(8, maxLeft); }

    var top = rect.bottom + 6;
    if (top + tipEl.offsetHeight > window.innerHeight - 8) {
      var above = rect.top - tipEl.offsetHeight - 6;
      if (above > 8) { top = above; }
    }

    tipEl.style.left = left + 'px';
    tipEl.style.top = top + 'px';
  }

  function hideTip() {
    tipEl.style.display = 'none';
  }

  document.addEventListener('mouseover', function (e) {
    var target = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    if (target) { showTip(target); }
  });

  document.addEventListener('mouseout', function (e) {
    var target = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    if (!target) { return; }
    // 在同一元素的子节点之间移动时不隐藏，避免闪烁
    if (e.relatedTarget && target.contains(e.relatedTarget)) { return; }
    hideTip();
  });

  document.addEventListener('mousedown', hideTip);
  window.addEventListener('scroll', hideTip, true);

  // 页面就绪：宿主收到后会回推端口列表与真实连接状态
  vscode.postMessage({ type: 'init' });
})();
</script>
</body>
</html>`;
}
