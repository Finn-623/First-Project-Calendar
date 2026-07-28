import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { EditActivitySheet } from './EditActivitySheet';

jest.mock('../components/ui/sheet', () => ({
  Sheet: ({ open, children }) => (open ? <div>{children}</div> : null),
  SheetContent: ({ children }) => <div>{children}</div>,
  SheetHeader: ({ children }) => <div>{children}</div>,
  SheetTitle: ({ children }) => <h2>{children}</h2>,
}));
jest.mock('../components/ui/input', () => ({
  Input: require('react').forwardRef((props, ref) => <input ref={ref} {...props} />),
}));
jest.mock('../components/ui/textarea', () => ({
  Textarea: require('react').forwardRef((props, ref) => <textarea ref={ref} {...props} />),
}));
jest.mock('../components/ui/button', () => ({
  Button: ({ children, variant, ...props }) => <button type="button" {...props}>{children}</button>,
}));

const eventItem = {
  id: 'event-1',
  type: 'event',
  item_type: 'other',
  title: '会议',
  event_date: '2026-07-28',
  time: '08:00',
  started_at: '2026-07-28T08:00:00',
  ended_at: '2026-07-28T10:30:00',
  notes: '',
  details: {},
  status: 'completed',
};

describe('EditActivitySheet 使用现在时间', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 28, 9, 5, 31));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('开始和结束按钮只更新各自字段，不自动保存或关闭', () => {
    const onConfirm = jest.fn();
    const onOpenChange = jest.fn();
    render(
      <EditActivitySheet
        open
        onOpenChange={onOpenChange}
        item={eventItem}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByTestId('edit-activity-start-use-now'));
    expect(screen.getByTestId('edit-activity-start-time-input').value).toBe('09:05');
    expect(screen.getByTestId('edit-activity-end-time-input').value).toBe('10:30:00');

    fireEvent.change(screen.getByTestId('edit-activity-start-time-input'), { target: { value: '09:07' } });
    fireEvent.click(screen.getByTestId('edit-activity-end-use-now'));
    expect(screen.getByTestId('edit-activity-start-time-input').value).toBe('09:07');
    expect(screen.getByTestId('edit-activity-end-time-input').value).toBe('09:05');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test('填入现在时间后点击保存才提交相应开始时间', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    render(
      <EditActivitySheet
        open
        onOpenChange={jest.fn()}
        item={eventItem}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByTestId('edit-activity-start-use-now'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-activity-confirm-btn'));
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][1].event_time).toBe('09:05');
    expect(onConfirm.mock.calls[0][1].started_at).toBe(new Date(2026, 6, 28, 9, 5).toISOString());
    expect(onConfirm.mock.calls[0][1].ended_at).toBe(new Date(2026, 6, 28, 10, 30).toISOString());
  });

  test('进行中记录的两个现在时间按钮保持禁用', () => {
    render(
      <EditActivitySheet
        open
        onOpenChange={jest.fn()}
        item={{ ...eventItem, status: 'running' }}
        onConfirm={jest.fn()}
      />
    );

    expect(screen.getByTestId('edit-activity-start-use-now').disabled).toBe(true);
    expect(screen.getByTestId('edit-activity-end-use-now').disabled).toBe(true);
  });
});
