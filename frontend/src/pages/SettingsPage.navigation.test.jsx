import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useStore } from '../store';
import { SettingsPage } from './SettingsPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    removeQueries: jest.fn(),
  }),
}));

jest.mock('../store', () => ({
  useStore: jest.fn(),
}));

jest.mock('../components/settings/SettingsNavigationItem', () => ({
  SettingsNavigationItem: ({ onClick, label, testId }) => (
    <button type="button" onClick={onClick} data-testid={testId}>{label}</button>
  ),
}));

jest.mock('../components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }) => <div>{children}</div>,
  AlertDialogContent: ({ children }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
  AlertDialogAction: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
}));

describe('SettingsPage 历史记录入口', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStore.mockReturnValue({
      profile: { display_name: '测试用户' },
      authLoading: false,
      logout: jest.fn(),
    });
  });

  test('设置中的记录历史记录入口继续导航到现有历史页面', () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByTestId('settings-entry-record-history'));

    expect(mockNavigate).toHaveBeenCalledWith('/history', {
      state: { returnTo: 'settings' },
    });
  });
});
