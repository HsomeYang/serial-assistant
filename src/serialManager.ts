// Copyright (c) 2026 HsomeYang.
// Licensed under the MIT License.

import { SerialPort } from "serialport";
import { LinkBase } from "./linkBase";

export type { CloseHandler, Counters, DataHandler } from "./linkBase";

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

/**
 * 串口收发管理。
 *
 * 解码、计数与事件分发由 LinkBase 统一处理，这里只负责连接的建立与释放。
 */
export class SerialManager extends LinkBase {
  private port: SerialPort | undefined;
  // 防止 error 与 close 两个事件重复上报关闭状态
  private closing = false;
  // 每次打开递增；close() 或新的 open() 会让进行中的旧 open 失效
  private openSeq = 0;

  // 保存固定引用，关闭时只摘自己的监听，避免连兜底的 error 监听一起摘掉
  private readonly onChunk = (chunk: Buffer): void => this.handleChunk(chunk);
  private readonly onPortError = (error: Error): void => this.handleClosed(error.message);
  private readonly onPortClose = (): void => this.handleClosed();

  public get isOpen(): boolean {
    return this.port !== undefined && this.port.isOpen;
  }

  public get openedPath(): string | undefined {
    return this.port?.path;
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

  /**
   * @param resetCounters 自动重连时传 false，保留累计收发计数
   */
  public open(options: OpenOptions, resetCounters = true): Promise<void> {
    if (this.isOpen) {
      return Promise.reject(new Error("串口已打开，请先关闭"));
    }

    // 上一次异常断开可能留下未释放的实例，先彻底丢弃，避免句柄堆积
    this.discard(this.port);
    this.port = undefined;
    this.closing = false;

    if (resetCounters) {
      this.resetCounters();
    }
    this.setEncoding(options.encoding);

    const seq = ++this.openSeq;

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

      let settled = false;
      // 个别驱动在端口异常时可能一直不回调，超时后主动放弃，避免打开流程卡死
      const guard = setTimeout(() => {
        if (settled || seq !== this.openSeq) {
          return;
        }
        settled = true;
        this.openSeq += 1;
        this.discard(port);
        reject(new Error("打开超时：串口驱动无响应"));
      }, 10000);

      port.open((error: Error | null) => {
        clearTimeout(guard);
        if (settled) {
          // 已超时放弃，晚到的结果直接丢弃，避免留下没人管理的已打开端口
          this.discard(port);
          return;
        }
        settled = true;

        if (error) {
          // 打开失败时释放实例，避免句柄与监听器残留
          this.discard(port);
          reject(error);
          return;
        }

        // 打开过程中又被 close() 或新的 open() 打断：释放掉这个实例
        if (seq !== this.openSeq) {
          this.discard(port);
          reject(new Error("打开已被取消"));
          return;
        }

        this.port = port;
        this.closing = false;
        port.on("data", this.onChunk);
        port.on("error", this.onPortError);
        port.on("close", this.onPortClose);
        resolve();
      });
    });
  }

  public close(): Promise<void> {
    // 让仍在进行中的 open 失效，否则它稍后成功会把端口重新打开
    this.openSeq += 1;
    const port = this.port;
    this.port = undefined;
    this.closing = true;

    if (!port) {
      return Promise.resolve();
    }

    // 只摘自己的监听并保留一个空 error 兜底：关闭过程中底层仍可能抛 ECONNRESET，
    // 若此时没有任何 error 监听，EventEmitter 会直接抛出未捕获异常。
    this.detach(port);

    if (!port.isOpen) {
      this.destroyQuietly(port);
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

      try {
        port.close((error: Error | null) => {
          if (error) {
            this.destroyQuietly(port);
          }
          finish();
        });
      } catch {
        this.destroyQuietly(port);
        finish();
      }

      // 驱动无响应时兜底，避免 close 永久挂起把界面卡在「已连接」
      setTimeout(() => {
        this.destroyQuietly(port);
        finish();
      }, 1500);
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
        this.addTxBytes(data.length);
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

  private handleClosed(reason?: string): void {
    const port = this.port;
    // error 之后通常还会跟一个 close，只处理第一次
    if (this.closing || !port) {
      return;
    }

    this.closing = true;
    this.port = undefined;
    // 掉线后必须真正释放句柄：只丢引用的话 Windows 上句柄仍被占用，
    // 重连同一端口会报 Access denied
    this.detach(port);
    this.destroyQuietly(port);

    this.emitClosed(reason);
  }

  /** 摘掉自己的监听，并挂一个空 error 监听兜底 */
  private detach(port: SerialPort): void {
    port.removeListener("data", this.onChunk);
    port.removeListener("error", this.onPortError);
    port.removeListener("close", this.onPortClose);
    port.on("error", () => undefined);
  }

  /** 丢弃一个实例（可能尚未打开成功），同时释放句柄 */
  private discard(port: SerialPort | undefined): void {
    if (!port) {
      return;
    }
    this.detach(port);
    this.destroyQuietly(port);
  }

  private destroyQuietly(port: SerialPort): void {
    try {
      if (port.isOpen) {
        port.destroy();
      }
    } catch {
      // 句柄已失效，忽略
    }
  }
}
