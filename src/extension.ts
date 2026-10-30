// Copyright (c) 2026 HsomeYang.
// Licensed under the MIT License.

import * as vscode from "vscode";
import { SerialMonitorView } from "./monitorPanel";

export function activate(context: vscode.ExtensionContext): void {
  const monitor = new SerialMonitorView();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SerialMonitorView.viewId, monitor, {
      // 切到其他面板 Tab 时不销毁 webview，避免接收区内容丢失
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("serialAssistant.open", async () => {
      // <viewId>.focus 由 VS Code 自动生成，用于把底部面板切到本视图
      await vscode.commands.executeCommand(SerialMonitorView.viewId + ".focus");
    })
  );

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  // name 用于区分同优先级的多个状态栏项，缺失时可能显示异常
  statusBar.name = "串口助手";
  statusBar.text = "$(plug) 串口助手";
  // 悬停可确认当前运行环境，便于在多 IDE 场景下排查
  statusBar.tooltip = `打开串口助手面板\n${vscode.env.appName} ${vscode.version}`;
  statusBar.command = "serialAssistant.open";
  statusBar.show();

  context.subscriptions.push(statusBar, monitor);
}

export function deactivate(): void {
  // 资源由 context.subscriptions 统一释放
}
