import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditTimeSheet } from './EditTimeSheet';

jest.mock('../components/ui/sheet', () => ({
  Sheet: ({ open, children }) => (open ? <div>{children}</div> : null),
  SheetContent: ({ children }) => <div>{children}</div>,
  SheetHeader: ({ children }) => <div>{children}</div>,
  SheetTitle: ({ children }) => <h2>{children}</h2>,
}));
jest.mock('../components/ui/input', () => ({
  Input: require('react').forwardRef((props, ref) => <input ref={ref} {...props} />),
}));
jest.mock('../components/ui/button', () => ({
  Button: ({ children, variant, ...props }) => <button type="button" {...props}>{children}</button>,
}));

describe('EditTimeSheet', () => {
  test('非法时间不能提交', () => {
    const onConfirm = jest.fn();
    render(
      <EditTimeSheet
        open
        onOpenChange={jest.fn()}
        item={{ title: '早餐', time: '08:00' }}
        onConfirm={onConfirm}
      />
    );

    fireEvent.change(screen.getByTestId('edit-time-input'), { target: { value: '' } });
    expect(screen.getByTestId('edit-time-confirm').disabled).toBe(true);
    fireEvent.click(screen.getByTestId('edit-time-confirm'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('保存期间禁用操作并防止重复提交，失败后保留弹窗和输入', async () => {
    let rejectSave;
    const onConfirm = jest.fn(() => new Promise((resolve, reject) => {
      rejectSave = reject;
    }));
    const onOpenChange = jest.fn();
    render(
      <EditTimeSheet
        open
        onOpenChange={onOpenChange}
        item={{ title: '早餐', time: '08:00' }}
        onConfirm={onConfirm}
      />
    );

    fireEvent.change(screen.getByTestId('edit-time-input'), { target: { value: '09:15' } });
    fireEvent.click(screen.getByTestId('edit-time-confirm'));
    fireEvent.click(screen.getByTestId('edit-time-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('edit-time-confirm').disabled).toBe(true);

    await act(async () => {
      rejectSave(new Error('保存失败'));
    });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('保存失败'));
    expect(screen.getByTestId('edit-time-input').value).toBe('09:15');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
