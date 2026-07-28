import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsSubpageHeader } from './SettingsSubpageHeader';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

describe('SettingsSubpageHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('keeps ordinary settings subpages on the existing settings return route', () => {
    render(<SettingsSubpageHeader title="账户" />);

    fireEvent.click(screen.getByRole('button', { name: '返回设置' }));
    expect(mockNavigate).toHaveBeenCalledWith('/settings', { replace: false });
  });

  test('supports one explicit version information return action for feedback pages', () => {
    render(
      <SettingsSubpageHeader
        title="修改意见"
        backTo="/settings/version"
        backLabel="返回版本信息"
        backReplace
      />
    );

    expect(screen.getAllByRole('button', { name: '返回版本信息' })).toHaveLength(1);
    expect(screen.queryByText('返回设置')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '返回版本信息' }));
    expect(mockNavigate).toHaveBeenCalledWith('/settings/version', { replace: true });
  });
});
