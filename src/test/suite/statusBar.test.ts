import * as assert from 'assert';
import * as sinon from 'sinon';
import { StatusBarManager } from '../../statusBar';

suite('StatusBar Test Suite', () => {
  let statusBar: StatusBarManager;
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
    statusBar = new StatusBarManager();
  });

  teardown(() => {
    sandbox.restore();
    statusBar.dispose();
  });

  test('Should update status bar text based on state', () => {
    // Test disabled state
    statusBar.update({
      isEnabled: false,
      isWorkspaceEnabled: true,
      serverAvailable: true
    });
    assert.strictEqual(statusBar['statusBarItem'].text, '$(stop-circle) Disabled');

    // Test workspace disabled state
    statusBar.update({
      isEnabled: true,
      isWorkspaceEnabled: false,
      serverAvailable: true
    });
    assert.strictEqual(
      statusBar['statusBarItem'].text,
      '$(stop-circle) Disabled for workspace'
    );

    // Test disconnected state
    statusBar.update({
      isEnabled: true,
      isWorkspaceEnabled: true,
      serverAvailable: false
    });
    assert.strictEqual(statusBar['statusBarItem'].text, '$(warning) Disconnected');

    // Test time display
    statusBar.update({
      isEnabled: true,
      isWorkspaceEnabled: true,
      serverAvailable: true,
      time: 3665 // 1h 1m 5s
    });
    assert.strictEqual(statusBar['statusBarItem'].text, '$(clock) 1h 1m');
  });
});