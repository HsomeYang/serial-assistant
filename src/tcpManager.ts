// Copyright (c) 2026 HsomeYang.
// Licensed under the MIT License.

import * as net from "net";
import { TextDecoder } from "util";
import { CloseHandler, Counters, DataHandler } from "./serialManager";

/**
 * TCP 连接管理，对外接口与 SerialManager 保持一致。
 *
 * 用于监视网络侧的数据流：ESP32 的 WiFi 日志、串口服务器转发的串口数据等。
 * 解码同样采用增量方式，中文长报文不会出现半个汉字。
 */
export class TcpManager {
  private socket: net.Socket | undefined;
  private decoder = new TextDecoder("utf-8");
  private rxBytes = 0;
  private txBytes = 0;
  // 防止 error 与 close 重复上报
  private closing = false;
  private target = "";

  private readonly dataHandlers: DataHandler[] = [];
  private readonly closeHandlers: CloseHandler[] = [];

  public onData(handler: DataHandler): void {
    this.dataHandlers.push(handler);
  }

  public onClosed(handler: CloseHandler): void {
    this.closeHandlers.push(handler);
  }

  public get isOpen(): boolean {
    return this.socket !== undefined && !this.socket.destroyed;
  }

  public get openedPath(): string | undefined {
    return this.isOpen ? this.target : undefined;
  }

  public get counters(): Counters {
    return { rx: this.rxBytes, tx: this.txBytes };
  }

  public resetCounters(): void {
    this.rxBytes = 0;
    this.txBytes = 0;
  }

  public setEncoding(encoding: string): void {
    try {
      this.decoder = new TextDecoder(encoding);
    } catch {
      this.decoder = new TextDecoder("utf-8");
    }
  }

  public open(host: string, port: number, encoding: string): Promise<void> {
    if (this.isOpen) {
      return Promise.reject(new Error("连接已建立，请先断开"));
    }

    this.setEncoding(encoding);
    this.resetCounters();
    this.target = host + ":" + port;

    return new Promise<void>((resolve, reject) => {
      const socket = net.connect({ host, port });

      const onConnectError = (error: Error): void => {
        socket.removeAllListeners();
        reject(error);
      };

      socket.once("error", onConnectError);
      socket.once("connect", () => {
        socket.removeListener("error", onConnectError);
        this.socket = socket;
        this.closing = false;
        socket.on("data", (chunk: Buffer) => this.handleData(chunk));
        socket.on("error", (err: Error) => this.handleClosed(err.message));
        socket.on("close", () => this.handleClosed());
        resolve();
      });
    });
  }

  public close(): Promise<void> {
    return new Promise<void>((resolve) => {
      const socket = this.socket;
      this.socket = undefined;
      this.closing = true;

      if (!socket) {
        resolve();
        return;
      }

      socket.removeAllListeners();

      if (socket.destroyed) {
        resolve();
        return;
      }

      socket.end(() => {
        socket.destroy();
        resolve();
      });
    });
  }

  public write(data: Buffer): Promise<void> {
    const socket = this.socket;
    if (!socket || socket.destroyed) {
      return Promise.reject(new Error("连接未建立"));
    }

    return new Promise<void>((resolve, reject) => {
      socket.write(data, (error?: Error | null) => {
        if (error) {
          reject(error);
          return;
        }
        this.txBytes += data.length;
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
    if (this.closing || !this.socket) {
      return;
    }
    this.closing = true;
    this.socket = undefined;
    for (const handler of this.closeHandlers) {
      handler(reason);
    }
  }
}
