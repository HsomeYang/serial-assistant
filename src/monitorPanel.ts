// Copyright (c) 2026 HsomeYang.
// Licensed under the MIT License.

import * as vscode from "vscode";
import { DataBits, FlowControl, Parity, SerialManager, StopBits } from "./serialManager";
import { buildWebviewHtml } from "./webviewHtml";
import { TcpManager } from "./tcpManager";

type LinkMode = "serial" | "tcp";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface OpenRequest {
  mode: LinkMode;
  path: string;
  host?: string;
  port?: number;
  baudRate: number;
  dataBits: DataBits;
  stopBits: StopBits;
  parity: Parity;
  flow: FlowControl;
  encoding: string;
}

type IncomingMessage =
  | { type: "refresh" }
  | { type: "open"; options: OpenRequest }
  | { type: "close" }
  | { type: "send"; data: string; hex: boolean; ending: string; escape: boolean }
  | { type: "encoding"; encoding: string }
  | { type: "signals"; dtr: boolean; rts: boolean }
  | { type: "reconnect"; enabled: boolean }
  | { type: "resetCounters" }
  | { type: "save"; content: string };

/**
 * 底部面板视图。
 *
 * 使用 WebviewViewProvider 注册到 viewsContainers.panel，
 * 使其与「问题 / 输出 / 调试控制台 / 终端」并列为面板 Tab，
 * 而不是像 createWebviewPanel 那样占用编辑器标签页。
 */
export class SerialMonitorView implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewId = "serialAssistant.main";

  private view: vscode.WebviewView | undefined;
  private readonly serial = new SerialManager();
  private readonly tcp = new TcpManager();
  private mode: LinkMode = "serial";
  // 端口列表自动刷新：只更新下拉内容，不自动连接
  private portsTimer: NodeJS.Timeout | undefined;
  private lastPortsKey = "";
  // 断线重连：已连接的串口意外断开时，用原参数重试，避免每次手动点开始监视
  private reconnectEnabled = true;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private reconnectOptions: OpenRequest | undefined;
  private reconnectAttempts = 0;
  // 同一时间只允许一次打开流程，避免重复点击把同一个端口打开两次
  private opening = false;
  // 端口轮询的重入保护：慢系统上枚举可能超过一个周期
  private polling = false;
  private messageDisposable: vscode.Disposable | undefined;
  // 面板被关闭重建后要把 DTR/RTS 回填给界面，宿主侧得记住当前电平
  private signals = { dtr: true, rts: true };

  constructor() {
    const bind = (link: SerialManager | TcpManager): void => {
      link.onData((text, hex) => {
        const counters = link.counters;
        void this.post({ type: "data", text, hex, ts: Date.now(), rx: counters.rx, tx: counters.tx });
      });
      link.onClosed((reason) => {
        void this.post({ type: "closed", reason });
      });
    };

    bind(this.serial);
    bind(this.tcp);

    // 串口异常断开时尝试重连；TCP 不自动重连
    this.serial.onClosed(() => {
      this.scheduleReconnect();
    });
  }

  /** 当前生效的连接层，状态查询与数据写入都走它 */
  private get link(): SerialManager | TcpManager {
    return this.mode === "tcp" ? this.tcp : this.serial;
  }

  public resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = buildWebviewHtml();

    this.messageDisposable?.dispose();
    this.messageDisposable = view.webview.onDidReceiveMessage((message: IncomingMessage) => {
      this.handleMessage(message);
    });

    // 面板被关闭时仅解除引用，保持串口连接，重新打开后仍可继续收发
    view.onDidDispose(() => {
      this.view = undefined;
      this.messageDisposable?.dispose();
      this.messageDisposable = undefined;
      // 界面没了就不必继续枚举端口，省掉每 2 秒一次的原生调用
      this.stopPortWatch();
    });

    this.startPortWatch();
    // 重建出来的 webview 是全新默认界面，必须回推真实状态，
    // 否则会显示「未连接 / 开始监视」，而端口其实还开着
    void this.postState();
  }

  /** 定时轮询端口列表，仅在内容变化时推送给界面 */
  private startPortWatch(): void {
    if (this.portsTimer) {
      return;
    }
    this.lastPortsKey = "";
    void this.syncPorts(true);
    this.portsTimer = setInterval(() => {
      void this.syncPorts(false);
    }, 2000);
  }

  private stopPortWatch(): void {
    if (this.portsTimer) {
      clearInterval(this.portsTimer);
      this.portsTimer = undefined;
    }
    this.polling = false;
  }

  /**
   * 枚举端口并推送给界面。
   *
   * @param force 手动刷新时即使列表没变也推送，并把枚举错误报到界面；
   *              定时轮询只在列表变化时推送，失败也保持原列表等下个周期
   */
  private async syncPorts(force: boolean): Promise<void> {
    if (!this.view || (this.polling && !force)) {
      return;
    }
    this.polling = true;
    try {
      const ports = await this.serial.listPorts();
      const key = ports.map((port) => port.path).join(",");
      if (!force && key === this.lastPortsKey) {
        return;
      }
      this.lastPortsKey = key;
      await this.post({ type: "ports", ports, opened: this.serial.openedPath });
    } catch (error) {
      if (force) {
        await this.notify("枚举串口失败：" + this.describe(error));
      }
    } finally {
      this.polling = false;
    }
  }

  public dispose(): void {
    this.stopReconnect();
    this.stopPortWatch();
    this.messageDisposable?.dispose();
    this.messageDisposable = undefined;
    this.serial.dispose();
    this.tcp.dispose();
  }

  private handleMessage(message: IncomingMessage): void {
    switch (message.type) {
      case "refresh":
        void this.syncPorts(true);
        // 界面加载完成（含面板关闭后重建）时回推真实状态：
        // resolveWebviewView 里推的那次早于页面加载，可能被丢弃
        void this.postState();
        break;
      case "open":
        void this.openPort(message.options);
        break;
      case "close":
        void this.closePort();
        break;
      case "send":
        void this.sendData(message.data, message.hex, message.ending, message.escape);
        break;
      case "encoding":
        // 两层都要设置：只改 serial 会让 TCP 模式下的编码切换完全失效
        this.serial.setEncoding(message.encoding);
        this.tcp.setEncoding(message.encoding);
        break;
      case "signals":
        this.signals = { dtr: message.dtr, rts: message.rts };
        void this.applySignals(message.dtr, message.rts);
        break;
      case "reconnect":
        this.reconnectEnabled = message.enabled;
        if (!message.enabled) {
          this.stopReconnect();
        }
        break;
      case "resetCounters":
        this.link.resetCounters();
        void this.postCounters();
        break;
      case "save":
        void this.saveLog(message.content);
        break;
      default:
        break;
    }
  }

  private async openPort(request: OpenRequest): Promise<void> {
    // 上一次打开还没结束（含 5 秒等待窗口）时不再启动第二次：
    // 否则同一个串口会被打开两次，数据重复回显、句柄互相顶掉
    if (this.opening) {
      await this.notify("正在打开连接，请稍候…");
      await this.postState();
      return;
    }

    this.opening = true;
    try {
      this.stopReconnect();
      this.reconnectOptions = undefined;

      if (request.mode === "tcp") {
        try {
          await this.tcp.open(request.host || "127.0.0.1", request.port || 8080, request.encoding);
          // 只有真正连上才切换模式，失败时界面仍按原连接层显示
          this.mode = "tcp";
        } catch (error) {
          await this.notify("打开失败：" + this.describe(error));
        }
        await this.postState();
        return;
      }

      // 串口：设备可能刚插入而系统尚未枚举完成，给 5 秒窗口反复尝试
      const deadline = Date.now() + 5000;
      let lastError: unknown = new Error("设备未就绪");
      let announced = false;

      for (;;) {
        try {
          await this.serial.open(request);
          this.mode = "serial";
          // 记录成功参数，断开后按原样重连
          this.reconnectOptions = request;
          await this.postState();
          return;
        } catch (error) {
          lastError = error;

          // 占用、权限等问题不会自愈，立即结束等待
          if (!this.isPortMissing(error) || Date.now() >= deadline) {
            break;
          }

          if (!announced) {
            announced = true;
            await this.post({ type: "waiting", path: request.path });
          }
          await delay(500);
        }
      }

      await this.notify("打开失败：" + this.describe(lastError));
      await this.postState();
    } finally {
      this.opening = false;
    }
  }

  /** 判断是否为「端口当前不存在」，这类错误值得等待重试 */
  private isPortMissing(error: unknown): boolean {
    const text = this.describe(error).toLowerCase();
    return (
      text.includes("file not found") ||
      text.includes("not found") ||
      text.includes("no such file") ||
      text.includes("系统找不到")
    );
  }

  private async closePort(): Promise<void> {
    // 手动停止意味着主动断开，不再重连
    this.stopReconnect();
    this.reconnectOptions = undefined;
    await this.serial.close();
    await this.tcp.close();
    await this.postState();
  }

  /** 串口意外断开后启动重试，成功或达到上限即停止 */
  private scheduleReconnect(): void {
    if (!this.reconnectEnabled || this.reconnectTimer) {
      return;
    }
    if (this.mode !== "serial" || !this.reconnectOptions) {
      return;
    }

    this.reconnectAttempts = 0;
    void this.post({ type: "reconnecting", attempt: 0 });

    // 1.5 秒一次，最多 40 次（约 1 分钟），避免设备长期离线时无谓占用
    this.reconnectTimer = setInterval(() => {
      void this.tryReconnect();
    }, 1500);
  }

  private async tryReconnect(): Promise<void> {
    const options = this.reconnectOptions;
    if (!options) {
      this.stopReconnect();
      return;
    }

    if (this.serial.isOpen) {
      this.stopReconnect();
      return;
    }

    // 上一次 open 还没回调（打开可能耗时数秒）时不要叠加第二次，
    // 否则同一个端口会被两个 SerialPort 实例同时打开
    if (this.opening) {
      return;
    }

    this.reconnectAttempts += 1;
    if (this.reconnectAttempts > 40) {
      this.stopReconnect();
      await this.notify("重连失败：设备约 1 分钟未恢复，请检查连接");
      return;
    }

    this.opening = true;
    try {
      // 重连不算重新开始，保留累计收发计数
      await this.serial.open(options, false);
      this.stopReconnect();
      await this.postState();
      await this.notify("已重连 " + options.path);
    } catch {
      // 端口仍未就绪，等下一个周期继续
      void this.post({ type: "reconnecting", attempt: this.reconnectAttempts });
    } finally {
      this.opening = false;
    }
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.reconnectAttempts = 0;
  }

  private async sendData(data: string, hex: boolean, ending: string, escape: boolean): Promise<void> {
    const endingLabel =
      ending === "\r\n" ? " <CRLF>" : ending === "\r" ? " <CR>" : ending === "\n" ? " <LF>" : "";

    try {
      // 允许「只发行尾符」：内容为空但有行尾时，发送的就是行尾字节
      const payload = data.length === 0 ? Buffer.alloc(0) : this.toBuffer(data, hex, escape);
      const trailer = ending ? Buffer.from(ending, "utf8") : Buffer.alloc(0);
      if (payload.length === 0 && trailer.length === 0) {
        throw new Error("发送内容为空");
      }
      const buffer = trailer.length > 0 ? Buffer.concat([payload, trailer]) : payload;

      await this.link.write(buffer);

      // 回显发送内容，便于在接收区区分「我发了什么」与「设备回了什么」
      const pairs = buffer.toString("hex").match(/../g);
      await this.post({
        type: "tx",
        text: data + endingLabel,
        hex: pairs ? pairs.join(" ").toUpperCase() : "",
        ts: Date.now(),
        ok: true,
      });
      await this.postCounters();
    } catch (error) {
      // 发送失败同样回显，便于确认「尝试发送了什么」，界面会标记失败
      await this.post({
        type: "tx",
        text: data + endingLabel,
        hex: "",
        ts: Date.now(),
        ok: false,
      });
      await this.notify(this.describe(error));
    }
  }

  private async saveLog(content: string): Promise<void> {
    const target = await vscode.window.showSaveDialog({
      saveLabel: "保存",
      filters: {
        "文本文件": ["txt", "log"],
        "所有文件": ["*"],
      },
    });

    if (!target) {
      return;
    }

    try {
      await vscode.workspace.fs.writeFile(target, Buffer.from(content, "utf8"));
      await this.notify("日志已保存：" + target.fsPath);
    } catch (error) {
      await this.notify("保存失败：" + this.describe(error));
    }
  }

  private toBuffer(data: string, hex: boolean, escape: boolean): Buffer {
    if (hex) {
      const clean = data.replace(/[\s,]/g, "");
      if (clean.length === 0) {
        throw new Error("发送内容为空");
      }
      if (!/^[0-9a-fA-F]+$/.test(clean)) {
        throw new Error("十六进制发送失败：包含非十六进制字符");
      }
      if (clean.length % 2 !== 0) {
        throw new Error("十六进制发送失败：字符个数必须为偶数");
      }
      return Buffer.from(clean, "hex");
    }

    if (data.length === 0) {
      throw new Error("发送内容为空");
    }

    return escape ? this.unescapeToBuffer(data) : Buffer.from(data, "utf8");
  }

  /**
   * 把 \\r \\n \\t \\0 \\\\ 与 \\xNN 解析为实际字节。
   * \\xNN 必须直接产生单字节，不能走 UTF-8 编码，否则会变成两字节。
   */
  private unescapeToBuffer(data: string): Buffer {
    const parts: Buffer[] = [];
    let literal = "";
    let index = 0;

    while (index < data.length) {
      const current = data[index];

      if (current === "\\" && index + 1 < data.length) {
        const next = data[index + 1];

        if (next === "x" && /^[0-9a-fA-F]{2}$/.test(data.slice(index + 2, index + 4))) {
          if (literal.length > 0) {
            parts.push(Buffer.from(literal, "utf8"));
            literal = "";
          }
          parts.push(Buffer.from([parseInt(data.slice(index + 2, index + 4), 16)]));
          index += 4;
          continue;
        }

        const map: Record<string, string> = {
          r: "\r",
          n: "\n",
          t: "\t",
          "0": "\0",
          "\\": "\\",
        };

        if (map[next] !== undefined) {
          if (literal.length > 0) {
            parts.push(Buffer.from(literal, "utf8"));
            literal = "";
          }
          parts.push(Buffer.from(map[next], "utf8"));
          index += 2;
          continue;
        }
      }

      literal += current;
      index += 1;
    }

    if (literal.length > 0) {
      parts.push(Buffer.from(literal, "utf8"));
    }

    return Buffer.concat(parts);
  }

  private async applySignals(dtr: boolean, rts: boolean): Promise<void> {
    // 控制线只对串口有意义
    if (this.mode === "tcp") {
      return;
    }
    try {
      await this.serial.setSignals({ dtr, rts });
    } catch (error) {
      await this.notify("设置 DTR/RTS 失败：" + this.describe(error));
    }
  }

  private async postState(): Promise<void> {
    const link = this.link;
    const counters = link.counters;
    await this.post({
      type: "state",
      open: link.isOpen,
      path: link.openedPath,
      rx: counters.rx,
      tx: counters.tx,
      mode: this.mode,
      // 面板重建后据此回填界面，避免显示状态与真实连接不一致
      encoding: link.currentEncoding,
      dtr: this.signals.dtr,
      rts: this.signals.rts,
      reconnect: this.reconnectEnabled,
    });
  }

  private async postCounters(): Promise<void> {
    const counters = this.link.counters;
    await this.post({ type: "counters", rx: counters.rx, tx: counters.tx });
  }

  private async notify(text: string): Promise<void> {
    await this.post({ type: "error", message: text });
  }

  private async post(message: unknown): Promise<void> {
    const view = this.view;
    if (!view) {
      return;
    }
    try {
      await view.webview.postMessage(message);
    } catch {
      // 视图已销毁时 postMessage 会抛错，丢弃本次推送即可
    }
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
