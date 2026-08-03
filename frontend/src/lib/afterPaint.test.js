import { scheduleAfterPaint } from './afterPaint';

describe('scheduleAfterPaint', () => {
  const originalRaf = window.requestAnimationFrame;

  afterEach(() => {
    window.requestAnimationFrame = originalRaf;
    jest.useRealTimers();
  });

  test('等待animation frame与后续task后才开始远程工作', () => {
    jest.useFakeTimers();
    let frameCallback;
    window.requestAnimationFrame = jest.fn((callback) => {
      frameCallback = callback;
      return 1;
    });
    const task = jest.fn();

    scheduleAfterPaint(task);
    expect(task).not.toHaveBeenCalled();

    frameCallback(16);
    expect(task).not.toHaveBeenCalled();

    jest.runOnlyPendingTimers();
    expect(task).toHaveBeenCalledTimes(1);
  });
});
