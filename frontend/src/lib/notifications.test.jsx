import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { Toaster, toast } from 'sonner';
import { showSuccess, SUCCESS_TOAST_DURATION_MS } from './notifications';

describe('统一操作提示', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      toast.dismiss();
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  test('成功提示约 2 秒后自动消失且不留下占位', () => {
    render(<Toaster />);

    act(() => {
      showSuccess('保存成功');
      jest.advanceTimersByTime(100);
    });
    expect(screen.getByText('保存成功')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(SUCCESS_TOAST_DURATION_MS + 1000);
    });
    expect(screen.queryByText('保存成功')).toBeNull();
  });

  test('连续相同成功操作复用同一提示，不叠加重复项', () => {
    render(<Toaster />);

    act(() => {
      showSuccess('修改成功');
      showSuccess('修改成功');
      jest.advanceTimersByTime(100);
    });

    expect(screen.getAllByText('修改成功')).toHaveLength(1);
  });

  test('错误提示不使用成功提示的短 duration', () => {
    render(<Toaster />);

    act(() => {
      toast.error('网络错误');
      jest.advanceTimersByTime(100);
      jest.advanceTimersByTime(SUCCESS_TOAST_DURATION_MS + 100);
    });

    expect(screen.getByText('网络错误')).toBeTruthy();
  });

  test('组件卸载后推进计时器不会产生状态更新警告', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const view = render(<Toaster />);

    act(() => {
      showSuccess('添加成功');
    });
    view.unmount();
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
