import * as vscode from 'vscode';
import { formatTime } from './utils';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.tooltip = 'Nexile Tracker';
    this.statusBarItem.text = '$(clock) Loading...';

    const commandId = 'nexile-tracker.openDashboard';
    this.statusBarItem.command = commandId;

    this.statusBarItem.show();
  }

  update(params: {
    isEnabled: boolean,
    isWorkspaceEnabled: boolean,
    serverAvailable: boolean,
    time?: number
  }) {
    const { isEnabled, isWorkspaceEnabled, serverAvailable, time } = params;

    if (!isEnabled) {
      this.statusBarItem.text = '$(stop-circle) Disabled';
      return;
    }

    if (!isWorkspaceEnabled) {
      this.statusBarItem.text = '$(stop-circle) Disabled for workspace';
      return;
    }

    if (!serverAvailable) {
      this.statusBarItem.text = '$(warning) Disconnected';
      return;
    }

    if (time === undefined) {
      this.statusBarItem.text = '$(clock)';
      return;
    }

    this.statusBarItem.text = `$(clock) ${formatTime(time)}`;
  }

  dispose() {
    this.statusBarItem.dispose();
  }
}