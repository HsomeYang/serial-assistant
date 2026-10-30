// Copyright (c) 2026 HsomeYang.
// Licensed under the MIT License.

import * as net from "net";
import { LinkBase } from "./linkBase";

/** 连接建立的超时时间：必须小于界面 12 秒的「打开超时」兜底，否则用户只看到超时而不知原因 */
const CONNECT_TIMEOUT = 8000;

/**
 * TCP 连接管理，对外接口与 SerialManager 保持一致。
 *
 * 用于监视网络侧的数据流：ESP32 的 WiFi 日志、串口服务器转发的串口数据等。
 * 解码、计数与事件分发由 LinkBase 统一处理，这里只负责连接的建立与释放。
 */
export class TcpManager extends LinkBase {
  // 连接中与已连接都由该字段持有，close() 才能取消进行中的 connect
  private socket: net.Socket | undefined;
  private connected = false;
  // 防止 error 与 close 重复上报
  private closing = false;
  private target = "";
  // 连接被取消时用来结算仍在等待的 open()，否则调用方会永久 await
  private pendingCancel: ((error: Error) => void) | undefined;

  private readonly onChunk = (chunk: Buffer): void => this.handleChunk(chunk);
  private readonly onSocketError = (error: Error): void => this.handleClosed(error.message);
  private readonly onSocketClose = (): void => this.handleClosed();

  public get isOpen(): boolean {
    return this.connected && this.socket !== undefined && !this.socket.destroyed;
  }

  /** 连接中或已连接，用于拒绝重复发起连接 */
  public get busy(): boolean {
    return this.socket !== undefined;
  }

  public get openedPath(): string | undefined {
    return this.isOpen ? this.target : undefined;
  }

  public open(host: string, port: number, encoding: string): Promise<void> {
    if (this.busy) {
      return Promise.reject(new Error("连接已建立或正在连接，请先断开"));
    }

    this.setEncoding(encoding);
    this.target = host + ":" + port;
    this.closing = false;

    return new Promise<void>((resolve, reject) => {
      const socket = net.connect({ host, port });
      // 立即登记，close() 才能销毁尚未连上的 socket
      this.socket = socket;

      let settled = false;
      let timer: NodeJS.Timeout | undefined;

      const fail = (error: Error): void => {
        if (settled) {
          return;
        }
        settled = true;
        this.pendingCancel = undefined;
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
        this.abandon(socket);
        if (this.socket === socket) {
          this.socket = undefined;
          this.connected = false;
        }
        reject(error);
      };

      // 未配置超时的话，不可达主机会让 SYN 重试几十秒，期间界面还能再点一次「开始监视」
      timer = setTimeout(() => {
        fail(new Error("连接 " + this.target + " 超时（" + CONNECT_TIMEOUT / 1000 + " 秒）"));
      }, CONNECT_TIMEOUT);

      this.pendingCancel = fail;
      socket.once("error", fail);
      socket.once("connect", () => {
        if (settled) {
          return;
        }
        settled = true;
        this.pendingCancel = undefined;
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
        socket.removeListener("error", fail);

        // 连接期间被 close() 取消：此时 this.socket 已被清空，丢弃这个迟到的连接
        if (this.socket !== socket) {
          this.abandon(socket);
          reject(new Error("连接已取消"));
          return;
        }

        this.connected = true;
        // 小包实时日志关掉 Nagle，避免多出几十毫秒延迟；KeepAlive 用于发现半开连接
        socket.setNoDelay(true);
        socket.setKeepAlive(true, 10000);
        socket.on("data", this.onChunk);
        socket.on("error", this.onSocketError);
        socket.on("close", this.onSocketClose);
        resolve();
      });
    });
  }

  public close(): Promise<void> {
    const socket = this.socket;
    this.socket = undefined;
    this.connected = false;
    this.closing = true;

    // 连接中的 open() 必须一并结算，否则调用方会永久 await、打开流程再也进不去
    const cancel = this.pendingCancel;
    this.pendingCancel = undefined;
    if (cancel) {
      cancel(new Error("连接已取消"));
    }

    if (!socket) {
      return Promise.resolve();
    }

    // 只摘自己的监听；随后仍可能收到 ECONNRESET，留空监听兜底
    this.detach(socket);

    if (socket.destroyed) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };

      // 对端不回应 FIN 时 end 可能长时间不回调，超时后强制销毁
      const timer = setTimeout(() => {
        this.destroyQuietly(socket);
        finish();
      }, 1000);

      socket.end(() => {
        clearTimeout(timer);
        this.destroyQuietly(socket);
        finish();
      });
    });
  }

  public write(data: Buffer): Promise<void> {
    const socket = this.socket;
    if (!this.isOpen || !socket) {
      return Promise.reject(new Error("连接未建立"));
    }

    return new Promise<void>((resolve, reject) => {
      socket.write(data, (error?: Error | null) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private handleClosed(reason?: string): void {
    const socket = this.socket;
    if (this.closing || !socket) {
      return;
    }

    this.closing = true;
    this.socket = undefined;
    this.connected = false;
    this.detach(socket);
    this.destroyQuietly(socket);

    this.emitClosed(reason);
  }

  /** 摘掉自己的监听，并挂一个空 error 监听兜底 */
  private detach(socket: net.Socket): void {
    socket.removeListener("data", this.onChunk);
    socket.removeListener("error", this.onSocketError);
    socket.removeListener("close", this.onSocketClose);
    socket.on("error", () => undefined);
  }

  /** 销毁一个可能仍在连接中的 socket */
  private abandon(socket: net.Socket): void {
    socket.removeAllListeners();
    socket.on("error", () => undefined);
    this.destroyQuietly(socket);
  }

  private destroyQuietly(socket: net.Socket): void {
    try {
      if (!socket.destroyed) {
        socket.destroy();
      }
    } catch {
      // 已销毁，忽略
    }
  }
}
