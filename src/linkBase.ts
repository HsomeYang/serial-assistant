// Copyright (c) 2026 HsomeYang.
// Licensed under the MIT License.

import { TextDecoder } from "util";

export type DataHandler = (text: string, hex: string) => void;
export type CloseHandler = (reason?: string) => void;

/**
 * Shared part of the serial and TCP links: incremental decoding and event
 * dispatch. Subclasses only handle connect/disconnect and call handleChunk()
 * when data arrives.
 *
 * Decoding is incremental (stream: true) so multi-byte characters split across
 * chunks are restored correctly instead of showing half a glyph.
 */
export abstract class LinkBase {
  private decoder = new TextDecoder("utf-8");
  private encoding = "utf-8";

  private readonly dataHandlers: DataHandler[] = [];
  private readonly closeHandlers: CloseHandler[] = [];

  public abstract get isOpen(): boolean;

  public abstract close(): Promise<void>;

  public onData(handler: DataHandler): void {
    this.dataHandlers.push(handler);
  }

  public onClosed(handler: CloseHandler): void {
    this.closeHandlers.push(handler);
  }

  /** 当前生效的解码方式，供界面在面板重建后回填 */
  public get currentEncoding(): string {
    return this.encoding;
  }

  public setEncoding(encoding: string): void {
    try {
      this.decoder = new TextDecoder(encoding);
      this.encoding = encoding;
    } catch {
      this.decoder = new TextDecoder("utf-8");
      this.encoding = "utf-8";
    }
  }

  public dispose(): void {
    void this.close();
  }

  /** 解码一个数据分片：text 供文本视图，hex 供十六进制视图 */
  protected handleChunk(chunk: Buffer): void {
    const text = this.decoder.decode(chunk, { stream: true });
    const pairs = chunk.toString("hex").match(/../g);
    const hex = pairs ? pairs.join(" ").toUpperCase() : "";

    for (const handler of this.dataHandlers) {
      handler(text, hex);
    }
  }

  protected emitClosed(reason?: string): void {
    for (const handler of this.closeHandlers) {
      handler(reason);
    }
  }
}
