import crypto from 'crypto';
import { basename } from 'path';
import * as vscode from 'vscode';

export function md5(data: string): string {
  return crypto.createHash('md5').update(data).digest('hex');
}

export function getProjectName(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return '';
  return basename(workspaceFolders[0].uri.fsPath);
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export type Utils = {
  md5: typeof md5;
  getProjectName: typeof getProjectName;
  formatTime: typeof formatTime;
};