import * as assert from 'assert';
import { md5, formatTime } from '../../utils';

suite('Utils Test Suite', () => {
  test('Should generate correct MD5 hash', () => {
    assert.strictEqual(
      md5('test'),
      '098f6bcd4621d373cade4e832627b4f6'
    );
  });

  test('Should format time correctly', () => {
    assert.strictEqual(formatTime(30), '0m');
    assert.strictEqual(formatTime(60), '1m');
    assert.strictEqual(formatTime(3600), '1h 0m');
    assert.strictEqual(formatTime(3665), '1h 1m');
  });
});