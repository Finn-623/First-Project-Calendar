import React from 'react';
import { render, screen } from '@testing-library/react';
import { BottomNav } from './BottomNav';

let mockPathname = '/';

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPathname }),
  NavLink: ({ to, end, className, children, ...props }) => {
    const isActive = end
      ? mockPathname === to
      : mockPathname === to || mockPathname.startsWith(`${to}/`);

    return (
      <a href={to} className={className({ isActive })} {...props}>
        {typeof children === 'function' ? children({ isActive }) : children}
      </a>
    );
  },
}), { virtual: true });

describe('BottomNav', () => {
  beforeEach(() => {
    mockPathname = '/';
  });

  test('只显示首页、食物库和设置，并使用三列布局', () => {
    render(<BottomNav />);

    expect(screen.getByTestId('nav-home')).toBeTruthy();
    expect(screen.getByTestId('nav-library')).toBeTruthy();
    expect(screen.getByTestId('nav-settings')).toBeTruthy();
    expect(screen.queryByTestId('nav-history')).toBeNull();
    expect(screen.queryByText('历史')).toBeNull();
    expect(screen.getByTestId('bottom-nav').firstElementChild.className).toContain('grid-cols-3');
  });

  test.each([
    ['/', 'nav-home'],
    ['/library', 'nav-library'],
    ['/settings/account', 'nav-settings'],
  ])('%s 路径正确选中对应入口', (pathname, activeTestId) => {
    mockPathname = pathname;
    render(<BottomNav />);

    expect(screen.getByTestId(activeTestId).className).toContain('text-[#6B8067]');
  });

  test('历史页面不会错误选中其他底部入口', () => {
    mockPathname = '/history/2026-07-27';
    render(<BottomNav />);

    expect(screen.getByTestId('nav-home').className).toContain('text-[#858C88]');
    expect(screen.getByTestId('nav-library').className).toContain('text-[#858C88]');
    expect(screen.getByTestId('nav-settings').className).toContain('text-[#858C88]');
  });
});
