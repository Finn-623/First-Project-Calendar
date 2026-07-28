import React from 'react';
import { render, screen } from '@testing-library/react';
import { LoginPage } from './LoginPage';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../services/authService', () => ({
  authService: {
    signInWithUsername: jest.fn(),
  },
}));

describe('LoginPage 退出后的普通登录界面', () => {
  test('不显示账号切换专用提示或流程', () => {
    render(<LoginPage onLoginSuccess={jest.fn()} />);

    expect(screen.getByTestId('login-username-input')).toBeTruthy();
    expect(screen.getByTestId('login-password-input')).toBeTruthy();
    expect(screen.getByTestId('login-submit-btn')).toBeTruthy();
    expect(screen.queryByText(/切换账号|切换账户|正在切换|请登录其他账号|请登录其他账户/)).toBeNull();
  });
});
