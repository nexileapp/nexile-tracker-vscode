import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { ActivityManager } from '../../activityManager';
import { Constants } from '../../constants';

suite('ActivityManager Test Suite', () => {
  let manager: ActivityManager;
  let context: vscode.ExtensionContext;
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();

    context = {
      extension: {
        packageJSON: { version: '1.0.0' }
      }
    } as any;

    manager = new ActivityManager(context, true, false);
  });

  teardown(() => {
    sandbox.restore();
  });

  test('Should create new activity', async () => {
    const fetchStub = sandbox.stub(global, 'fetch');
    fetchStub.resolves(new Response(JSON.stringify({ id: 'test-id' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));

    const editor = {
      document: {
        fileName: 'test.ts',
        languageId: 'typescript'
      },
      selection: {
        active: { line: 1 }
      }
    } as any;

    await manager.createActivity(editor);

    assert.strictEqual(manager['currentActivityId'], 'test-id');
    assert.notStrictEqual(manager['lastActivity'], null);
    assert.strictEqual(manager['creatingActivity'], false);
  });

  test('Should handle activity updates', async () => {
    const fetchStub = sandbox.stub(global, 'fetch');
    fetchStub.resolves(new Response(null, { status: 200 }));

    manager['currentActivityId'] = 'test-id';

    await manager.updateActivity({
      updateEnd: true,
      status: 'RUNNING'
    });

    assert.strictEqual(
      fetchStub.calledWith(`${Constants.SERVER_URL}/activity/test-id`),
      true
    );
  });

  test('Should finish activity', async () => {
    const updateStub = sandbox.stub(manager, 'updateActivity').resolves();
    manager['currentActivityId'] = 'test-id';

    await manager.finishActivity();

    assert.strictEqual(manager['currentActivityId'], null);
    assert.strictEqual(manager['lastActivity'], null);
    assert.strictEqual(
      updateStub.calledWith({
        updateEnd: true,
        status: 'FINISHED'
      }),
      true
    );
  });
});