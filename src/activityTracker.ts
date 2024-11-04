import * as vscode from 'vscode';
import { Constants } from './constants';
import { StatusBarManager } from './statusBar';
import { ActivityManager } from './activityManager';
import { UpdateActivityRequest, ProjectTime } from './types';
import { getProjectName, md5 } from './utils';
import { basename } from 'node:path';

export class ActivityTracker {
  private debugMode: boolean = true;
  private isActive = false;
  private serverAvailable = false;
  private isEnabled = true;
  private disabledWorkspaces: Set<string>;

  private idleTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private checkServerInterval: NodeJS.Timeout | null = null;
  private timeRefreshInterval: NodeJS.Timeout | null = null;

  private statusBarManager: StatusBarManager;
  private activityManager: ActivityManager;

  constructor(private context: vscode.ExtensionContext) {
    this.disabledWorkspaces = new Set(
      this.context.globalState.get<string[]>('nexile-tracker.disabledWorkspaces') || []
    );
    this.isEnabled = this.context.globalState.get('nexile-tracker.enabled', true);

    this.statusBarManager = new StatusBarManager();
    this.activityManager = new ActivityManager(context, this.serverAvailable, this.debugMode);

    this.registerCommands();
    this.initialize();
  }

  private registerCommands() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand('nexile-tracker.openDashboard', () => {
        vscode.env.openExternal(vscode.Uri.parse(Constants.DASHBOARD_URL));
      }),

      vscode.commands.registerCommand('nexile-tracker.toggleEnable', async () => {
        this.isEnabled = !this.isEnabled;
        await this.context.globalState.update('nexile-tracker.enabled', this.isEnabled);

        if (this.isEnabled) {
          vscode.window.showInformationMessage('Nexile Tracker enabled');
          this.startTracking();
        } else {
          vscode.window.showInformationMessage('Nexile Tracker disabled');
          this.stopTracking();
        }

        this.updateTime();
      }),

      vscode.commands.registerCommand('nexile-tracker.toggleWorkspace', async () => {
        const workspaceName = getProjectName();
        if (workspaceName === '') {
          vscode.window.showWarningMessage('No workspace is currently open');
          return;
        }

        const isDisabled = this.disabledWorkspaces.has(workspaceName);

        if (isDisabled) {
          this.disabledWorkspaces.delete(workspaceName);
          vscode.window.showInformationMessage(`Nexile Tracker enabled for ${workspaceName}`);
          this.startTracking();
        } else {
          this.disabledWorkspaces.add(workspaceName);
          vscode.window.showInformationMessage(`Nexile Tracker disabled for ${workspaceName}`);
          this.stopTracking();
        }

        await this.context.globalState.update(
          'nexile-tracker.disabledWorkspaces',
          Array.from(this.disabledWorkspaces)
        );

        this.updateStatusBar();
      })
    );
  }

  private async initialize() {
    await this.checkServer();

    if (this.serverAvailable && this.isEnabled && this.isWorkspaceEnabled()) {
      this.startTracking();
      await this.updateTime();
    }

    this.checkServerInterval = setInterval(() => {
      this.checkServer();
    }, 60000);

    this.timeRefreshInterval = setInterval(() => {
      if (this.serverAvailable && this.isEnabled && this.isWorkspaceEnabled()) {
        this.updateTime();
      }
    }, Constants.TIME_REFRESH_INTERVAL);
  }

  private async checkServer(): Promise<boolean> {
    try {
      const response = await fetch(`${Constants.SERVER_URL}/ping`, {
        method: 'GET',
        headers: {
          'X-Client-Type': 'vscode-extension',
          'X-Client-Version': this.context.extension.packageJSON.version
        }
      });

      const wasAvailable = this.serverAvailable;
      this.serverAvailable = response.ok;

      if (!wasAvailable && this.serverAvailable) {
        this.startTracking();
      } else if (wasAvailable && !this.serverAvailable) {
        this.showServerError();
      } else if (!wasAvailable && !this.serverAvailable) {
        this.showServerError();
      }

      return this.serverAvailable;
    } catch (error) {
      this.serverAvailable = false;
      this.showServerError();
      return false;
    }
  }

  private showServerError() {
    const message = 'Nexile Tracker Desktop app must be running to track activity';
    const openSettings = 'Open Settings';
    const downloadApp = 'Download App';

    vscode.window.showErrorMessage(message, openSettings, downloadApp).then(selection => {
      if (selection === openSettings) {
        vscode.commands.executeCommand('workbench.action.openSettings', 'nexile-tracker');
      } else if (selection === downloadApp) {
        vscode.env.openExternal(vscode.Uri.parse('https://nexile.app/desktop'));
      }
    });
  }

  private isWorkspaceEnabled(): boolean {
    const workspaceName = getProjectName();
    return !this.disabledWorkspaces.has(workspaceName);
  }

  private stopTracking() {
    this.isActive = false;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private async startTracking() {
    // Track document saves (major activity)
    vscode.workspace.onDidSaveTextDocument(() => {
      this.activityManager.updateLastMajorActivityTime();
      this.trackActivity();
    });

    // Track active editor changes
    vscode.window.onDidChangeActiveTextEditor(() => this.trackActivity());

    // Track cursor movement/selection
    vscode.window.activeTextEditor?.document && vscode.window.onDidChangeTextEditorSelection(() => {
      this.resetIdleTimer();
    });

    // Track debugging sessions
    vscode.debug.onDidStartDebugSession(session => {
      this.activityManager.setDebugSession(session);
      this.trackActivity();
    });

    vscode.debug.onDidTerminateDebugSession(() => {
      this.activityManager.setDebugSession(null);
      this.trackActivity();
    });

    // Setup heartbeat
    this.setupHeartbeat();

    // Initial tracking
    this.trackActivity();
  }

  private resetIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    const wasIdle = !this.isActive;
    this.isActive = true;

    this.idleTimer = setTimeout(() => {
      this.handleIdle();
    }, Constants.IDLE_TIMEOUT);

    if (wasIdle) {
      this.trackActivity();
    }
  }

  private async trackActivity() {
    if (!this.serverAvailable || !this.isEnabled || !this.isWorkspaceEnabled()) {
      console.log('Skipping activity tracking', {
        reason: !this.serverAvailable ? 'server unavailable' :
          !this.isEnabled ? 'tracker disabled' :
            'workspace disabled'
      });
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      console.log('Skipping activity tracking: no active editor');
      return;
    }

    this.resetIdleTimer();

    if (await this.activityManager.shouldCreateNewActivity()) {
      await this.activityManager.createActivity(editor);
    } else if (this.activityManager.getCurrentActivityId()) {
      const document = editor.document;
      const devActivity = this.activityManager.debugSession ? 'debugging' : 'coding';

      const updateRequest: UpdateActivityRequest = {
        updateEnd: true,
        status: 'RUNNING',
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

      await this.activityManager.updateActivity(updateRequest);
    }
  }

  private setupHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.isActive && this.serverAvailable && this.activityManager.getCurrentActivityId()) {
        this.sendHeartbeat();
      }
    }, Constants.HEARTBEAT_INTERVAL);
  }

  private async sendHeartbeat() {
    const updateRequest: UpdateActivityRequest = {
      updateEnd: true,
      status: 'RUNNING'
    };

    await this.activityManager.updateActivity(updateRequest);
  }

  private async handleIdle() {
    this.isActive = false;

    if (this.activityManager.getCurrentActivityId()) {
      const updateRequest: UpdateActivityRequest = {
        updateEnd: true,
        status: 'PAUSED',
        metadata: {
          title: 'Idle',
          hash: md5('idle'),
          extra: {
            activity: 'idle'
          }
        }
      };

      await this.activityManager.updateActivity(updateRequest);
    }
  }

  private updateStatusBar(time?: number) {
    this.statusBarManager.update({
      isEnabled: this.isEnabled,
      isWorkspaceEnabled: this.isWorkspaceEnabled(),
      serverAvailable: this.serverAvailable,
      time
    });
  }

  private async updateTime() {
    if (!this.serverAvailable) return;

    try {
      const response = await fetch(
        `${Constants.SERVER_URL}/time`,
        {
          headers: {
            'X-Client-Type': 'vscode-extension',
            'X-Client-Version': this.context.extension.packageJSON.version
          }
        }
      );

      if (response.ok) {
        const data: ProjectTime = await response.json() as ProjectTime;
        this.updateStatusBar(data.seconds || 0);
      }
    } catch (error) {
      console.error('Failed to fetch time:', error);
      await this.checkServer();
    }
  }

  async dispose() {
    try {
      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
        this.idleTimer = null;
      }
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
      if (this.checkServerInterval) {
        clearInterval(this.checkServerInterval);
        this.checkServerInterval = null;
      }
      if (this.timeRefreshInterval) {
        clearInterval(this.timeRefreshInterval);
        this.timeRefreshInterval = null;
      }

      if (this.activityManager) {
        await this.activityManager.finishActivity();
      }

      if (this.statusBarManager) {
        this.statusBarManager.dispose();
      }
    } catch (error) {
      console.error('Error during disposal:', error);
    }
  }

  public getActivityManager() {
    return this.activityManager;
  }

  public getStatusBarManager() {
    return this.statusBarManager;
  }

  public getServerAvailable(): boolean {
    return this.serverAvailable;
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public getDisabledWorkspaces(): Set<string> {
    return new Set(this.disabledWorkspaces);
  }

  public getIsActive(): boolean {
    return this.isActive;
  }
}