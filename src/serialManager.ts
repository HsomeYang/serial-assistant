// Copyright (c) 2026 HsomeYang.
// Licensed under the MIT License.

import { TextDecoder } from "util";
import { SerialPort } from "serialport";

export interface PortInfo {
  path: string;
  friendlyName?: string;
  manufacturer?: string;
}

export type DataBits = 5 | 6 | 7 | 8;
export type StopBits = 1 | 1.5 | 2;
export type Parity = "none" | "odd" | "even" | "mark" | "space";
export type FlowControl = "none" | "hardware" | "software";

export interface OpenOptions {
  path: string;
  baudRate: number;
  dataBits: DataBits;
  stopBits: StopBits;
  parity: Parity;
  flow: FlowControl;
  encoding: string;
}

export interface Counters {
  rx: number;
  tx: number;
}

export type DataHandler = (text: string, hex: string) => void;
export type CloseHandler = (reason?: string) => void;

/**
 * 串口收发管理。
 *
 * 解码采用增量方式（stream: true），保证被分包截断的多字节字符
 * （UTF-8 三字节 / GB18030 两字节）能正确还原，不会出现半个汉字。
 */
export class SerialManager {
  private port: SerialPort | undefined;
  private decoder = new TextDecoder("utf-8");
  private rxBytes = 0;
  private txBytes = 0;
  // 防止 error 与 close 两个事件重复上报关闭状态
  private closing = false;

  private readonly dataHandlers: DataHandler[] = [];
  private readonly closeHandlers: CloseHandler[] = [];

  public onData(handler: DataHandler): void {
    this.dataHandlers.push(handler);
  }

  public onClosed(handler: CloseHandler): void {
    this.closeHandlers.push(handler);
  }

  public get isOpen(): boolean {
    return this.port !== undefined && this.port.isOpen;
  }

  public get openedPath(): string | undefined {
    return this.port?.path;
  }

  public get counters(): Counters {
    return { rx: this.rxBytes, tx: this.txBytes };
  }

  public resetCounters(): void {
    this.rxBytes = 0;
    this.txBytes = 0;
  }

  public async listPorts(): Promise<PortInfo[]> {
    const ports = await SerialPort.list();
    // friendlyName 是 Windows 平台在运行时返回的字段，serialport 的类型声明中未包含
    return ports.map((port) => {
      const raw = port as unknown as {
        path: string;
        friendlyName?: string;
        manufacturer?: string;
      };
      return {
        path: raw.path,
        friendlyName: raw.friendlyName,
        manufacturer: raw.manufacturer,
      };
    });
  }

  public setEncoding(encoding: string): void {
    try {
      this.decoder = new TextDecoder(encoding);
    } catch {
      this.decoder = new TextDecoder("utf-8");
    }
  }

  public open(options: OpenOptions): Promise<void> {
    if (this.isOpen) {
      return Promise.reject(new Error("串口已打开，请先关闭"));
    }

    this.setEncoding(options.encoding);
    this.resetCounters();

    return new Promise<void>((resolve, reject) => {
      const port = new SerialPort({
        path: options.path,
        baudRate: options.baudRate,
        dataBits: options.dataBits,
        stopBits: options.stopBits,
        parity: options.parity,
        // 硬件流控走 rtscts，软件流控走 xon/xoff
        rtscts: options.flow === "hardware",
        xon: options.flow === "software",
        xoff: options.flow === "software",
        autoOpen: false,
      });

      port.open((error: Error | null) => {
        if (error) {
          // 打开失败时释放实例，避免句柄与监听器残留
          port.removeAllListeners();
          reject(error);
          return;
        }
        this.port = port;
        this.closing = false;
        port.on("data", (chunk: Buffer) => this.handleData(chunk));
        port.on("error", (err: Error) => this.handleClosed(err.message));
        port.on("close", () => this.handleClosed());
        resolve();
      });
    });
  }

  public close(): Promise<void> {
    return new Promise<void>((resolve) => {
      const port = this.port;
      this.port = undefined;

      if (!port) {
        resolve();
        return;
      }

      // 先摘掉监听，避免 close 回调里再次触发状态更新造成回环
      port.removeAllListeners();

      if (!port.isOpen) {
        resolve();
        return;
      }

      port.close(() => resolve());
    });
  }

  public write(data: Buffer): Promise<void> {
    const port = this.port;
    if (!port || !port.isOpen) {
      return Promise.reject(new Error("串口未打开"));
    }

    return new Promise<void>((resolve, reject) => {
      port.write(data, (error: Error | null | undefined) => {
        if (error) {
          reject(error);
          return;
        }
        this.txBytes += data.length;
        resolve();
      });
    });
  }

  /**
   * 手动控制 DTR / RTS 电平。
   *
   * 注意：启用硬件流控（rtscts）后 RTS 由驱动接管，手动设置可能被覆盖。
   */
  public setSignals(signals: { dtr?: boolean; rts?: boolean }): Promise<void> {
    const port = this.port;
    if (!port || !port.isOpen) {
      return Promise.reject(new Error("串口未打开"));
    }

    return new Promise<void>((resolve, reject) => {
      port.set(signals, (error: Error | null) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  public dispose(): void {
    void this.close();
  }

  private handleData(chunk: Buffer): void {
    this.rxBytes += chunk.length;

    const text = this.decoder.decode(chunk, { stream: true });
    const pairs = chunk.toString("hex").match(/../g);
    const hex = pairs ? pairs.join(" ").toUpperCase() : "";

    for (const handler of this.dataHandlers) {
      handler(text, hex);
    }
  }

  private handleClosed(reason?: string): void {
    // error 之后通常还会跟一个 close，只处理第一次
    if (this.closing || !this.port) {
      return;
    }
    this.closing = true;
    this.port = undefined;
    for (const handler of this.closeHandlers) {
      handler(reason);
    }
  }
}
