import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { ActivityTracker } from '../../activityTracker';
import { ActivityManager } from '../../activityManager';
import { StatusBarManager } from '../../statusBar';
import { Constants } from '../../constants';
import * as utils from '../../utils';

suite('ActivityTracker Test Suite', () => {
  let tracker: ActivityTracker;
  let context: vscode.ExtensionContext;
  let sandbox: sinon.SinonSandbox;
  let commandsStub: sinon.SinonStub;
  let fetchStub: sinon.SinonStub;
  let commandHandlers: Map<string, (...args: any[]) => any> = new Map();

  setup(async () => {
    sandbox = sinon.createSandbox();
    commandHandlers.clear();

    // Stub command registration to capture handlers
    commandsStub = sandbox.stub(vscode.commands, 'registerCommand').callsFake((command, handler) => {
      commandHandlers.set(command, handler);
      return { dispose: () => { } };
    });

    // Stub command execution to use captured handlers
    sandbox.stub(vscode.commands, 'executeCommand').callsFake(async (command, ...args) => {
      const handler = commandHandlers.get(command);
      if (handler) {
        return handler(...args);
      }
      return undefined;
    });

    // Mock extension context
    context = {
      subscriptions: [],
      workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve()
      },
      globalState: {
        get: (key: string, defaultValue?: any) => {
          if (key === 'nexile-tracker.enabled') return true;
          if (key === 'nexile-tracker.disabledWorkspaces') return [];
          return defaultValue;
        },
        update: () => Promise.resolve()
      },
      extension: {
        packageJSON: { version: '1.0.0' }
      }
    } as any;

    // Stub window messages
    sandbox.stub(vscode.window, 'showInformationMessage').resolves();
    sandbox.stub(vscode.window, 'showErrorMessage').resolves();
    sandbox.stub(vscode.window, 'showWarningMessage').resolves();

    let pingCount = 0;
    fetchStub = sandbox.stub(global, 'fetch').callsFake(async (url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString();
      if (urlString.includes('/ping')) {
        pingCount++;
        return new Response(null, {
          status: pingCount === 1 ? 200 : 500
        });
      }
      if (urlString.includes('/time')) {
        return new Response(JSON.stringify({ seconds: 100, lastUpdate: Date.now() }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(null, { status: 404 });
    });

    // Create tracker instance and wait for initialization
    tracker = new ActivityTracker(context);
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  teardown(async () => {
    if (tracker) {
      await tracker.dispose();
    }
    sandbox.restore();
  });

  test('Should handle server availability changes', async () => {
    // First check with server available
    fetchStub.resetBehavior();
    fetchStub.callsFake(async () => new Response(null, { status: 200 }));
    await tracker['checkServer']();
    assert.strictEqual(tracker['serverAvailable'], true, 'Server should be available on first check');

    // Second check with server unavailable
    fetchStub.resetBehavior();
    fetchStub.callsFake(async () => new Response(null, { status: 500 }));
    await tracker['checkServer']();
    assert.strictEqual(tracker['serverAvailable'], false, 'Server should be unavailable on second check');
  });

  test('Should handle workspace toggling', async () => {
    // Setup test workspace
    const testWorkspace = 'test-workspace';
    sandbox.stub(utils, 'getProjectName').returns(testWorkspace);

    // Initial state should not have the workspace disabled
    assert.strictEqual(
      tracker['disabledWorkspaces'].has(testWorkspace),
      false,
      'Workspace should not be disabled initially'
    );

    // Execute toggle command directly through the handler
    const toggleHandler = commandHandlers.get('nexile-tracker.toggleWorkspace');
    if (!toggleHandler) {
      throw new Error('Toggle workspace handler not found');
    }

    // First toggle - should disable the workspace
    await toggleHandler();
    assert.strictEqual(
      tracker['disabledWorkspaces'].has(testWorkspace),
      true,
      'Workspace should be disabled after first toggle'
    );

    // Second toggle - should enable the workspace
    await toggleHandler();
    assert.strictEqual(
      tracker['disabledWorkspaces'].has(testWorkspace),
      false,
      'Workspace should be enabled after second toggle'
    );
  });

  test('Should handle failed server requests', async () => {
    fetchStub.resetBehavior();
    fetchStub.rejects(new Error('Network error'));

    await tracker['checkServer']();
    assert.strictEqual(tracker['serverAvailable'], false, 'Server should be unavailable after network error');

    await tracker['updateTime']();
    assert.ok(fetchStub.called, 'Fetch should have been called');
  });

  test('Should toggle extension enable/disable', async () => {
    const toggleHandler = commandHandlers.get('nexile-tracker.toggleEnable');
    if (!toggleHandler) {
      throw new Error('Toggle enable handler not found');
    }

    const initialState = tracker['isEnabled'];

    // First toggle
    await toggleHandler();
    assert.strictEqual(tracker['isEnabled'], !initialState, 'Should toggle enabled state');

    // Second toggle
    await toggleHandler();
    assert.strictEqual(tracker['isEnabled'], initialState, 'Should revert to initial state');
  });
});