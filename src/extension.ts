import * as vscode from 'vscode';
import { ActivityTracker } from './activityTracker';

export async function activate(context: vscode.ExtensionContext) {
  console.log('Nexile Tracker extension activated');

  const tracker = new ActivityTracker(context);
  context.subscriptions.push({ dispose: () => tracker.dispose() });
}

export function deactivate() { }