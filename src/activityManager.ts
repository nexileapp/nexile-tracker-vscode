import * as vscode from 'vscode';
import os from 'os';
import { basename } from 'path';
import { Constants } from './constants';
import { CreateActivityRequest, UpdateActivityRequest } from './types';
import { md5, getProjectName } from './utils';
import { ActivityTracker } from './activityTracker';

export class ActivityManager {
  private creatingActivity: boolean = false;
  private updateInProgress: boolean = false;
  private currentActivityId: string | null = null;
  private lastActivity: CreateActivityRequest | null = null;
  public debugSession: vscode.DebugSession | null = null;

  constructor(
    private context: vscode.ExtensionContext,
    private activityTracker: ActivityTracker,
  ) { }

  private debugLog(message: string, data?: any) {
    if (this.activityTracker.debugMode) {
      const timestamp = new Date().toISOString();
      const logMessage = `[Nexile Debug ${timestamp}] ${message}`;
      console.log(logMessage);
      if (data) {
        console.log('Data:', JSON.stringify(data, null, 2));
      }
    }
  }

  async shouldCreateNewActivity(): Promise<boolean> {
    if (this.creatingActivity) return false;
    if (!this.currentActivityId) return true;
    if (!this.lastActivity) return true;

    const currentProject = getProjectName();
    return currentProject !== this.lastActivity.applicationProjectName;
  }

  async createActivity(editor: vscode.TextEditor): Promise<void> {
    const document = editor.document;
    const devActivity = this.debugSession ? 'debugging' : 'coding';

    const createRequest: CreateActivityRequest = {
      sourceName: 'vscode',
      start: new Date(),
      status: 'RUNNING',
      applicationName: 'Visual Studio Code',
      applicationProjectName: getProjectName(),
      os: os.platform(),
      metadata: {
        title: basename(document.fileName),
        location: `${document.fileName}:${editor.selection.active.line + 1}`,
        hash: md5(`${getProjectName()}:${document.fileName}`),
        extra: {
          activity: devActivity,
          file: basename(document.fileName),
          language: document.languageId,
        }
      }
    };

    this.debugLog('Sending create activity request', createRequest);
    const response = await this.sendActivityRequest(createRequest) as { id: string } | undefined;

    if (response?.id) {
      this.currentActivityId = response.id;
      this.lastActivity = createRequest;
      this.debugLog('Activity created successfully', { activityId: response.id });
    }

    this.creatingActivity = false;
  }

  async updateActivity(request: UpdateActivityRequest) {
    if (!this.activityTracker.serverAvailable || !this.currentActivityId) {
      this.debugLog('Cannot update activity', {
        reason: !this.activityTracker.serverAvailable ? 'server unavailable' : 'no current activity',
        activityId: this.currentActivityId
      });
      return;
    }

    if (this.updateInProgress) {
      this.debugLog('Update already in progress, skipping');
      return;
    }

    try {
      this.updateInProgress = true;
      this.debugLog('Sending activity update request', {
        activityId: this.currentActivityId,
        request
      });

      const response = await fetch(`${Constants.SERVER_URL}/activity/${this.currentActivityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Type': 'vscode',
          'X-Client-Version': this.context.extension.packageJSON.version
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        this.debugLog('Activity update failed', { status: response.status });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.debugLog('Activity update successful');

      if (request.status === 'FINISHED') {
        this.debugLog('Activity finished and cleared');
      }

      return await response.json();
    } catch (error: any) {
      this.debugLog('Failed to update activity', { error: error.message });
    } finally {
      this.updateInProgress = false;
    }

    return undefined;
  }

  private async sendActivityRequest(request: CreateActivityRequest) {
    if (!this.activityTracker.serverAvailable) {
      this.debugLog('Cannot send activity request: server unavailable');
      return;
    }

    try {
      const response = await fetch(`${Constants.SERVER_URL}/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Type': 'vscode',
          'X-Client-Version': this.context.extension.packageJSON.version
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        this.debugLog('Activity request failed', { status: response.status });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.debugLog('Activity request successful');
      return await response.json();
    } catch (error: any) {
      this.debugLog('Failed to send activity', { error: error.message });
      console.error('Failed to send activity:', error);
    }

    return undefined;
  }

  async finishActivity() {
    if (this.currentActivityId) {
      const updateRequest: UpdateActivityRequest = {
        updateEnd: true,
        status: 'FINISHED',
        metadata: {
          title: 'Finished',
          hash: md5('finished'),
          extra: {
            activity: 'finished'
          }
        }
      };

      await this.updateActivity(updateRequest);
      this.currentActivityId = null;
      this.lastActivity = null;
    }
  }

  setDebugSession(session: vscode.DebugSession | null) {
    this.debugSession = session;
  }

  getCurrentActivityId() {
    return this.currentActivityId;
  }
}