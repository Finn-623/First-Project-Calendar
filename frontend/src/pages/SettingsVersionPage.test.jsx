import React from 'react';
import { render, screen } from '@testing-library/react';
import { SettingsVersionPage } from './SettingsVersionPage';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

jest.mock('../components/settings/SettingsSubpageHeader', () => ({
  SettingsSubpageHeader: ({ title, description }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));

jest.mock('../components/ui/accordion', () => ({
  Accordion: ({ children }) => <div>{children}</div>,
  AccordionItem: ({ children }) => <div>{children}</div>,
  AccordionTrigger: ({ children }) => <div>{children}</div>,
  AccordionContent: ({ children }) => <div>{children}</div>,
}));

describe('SettingsVersionPage', () => {
  test('网页只展示最新 v0.1.2，不展示旧版本或版本状态', () => {
    render(<SettingsVersionPage />);

    expect(screen.getAllByText('v0.1.2').length).toBeGreaterThan(0);
    expect(screen.getByText('版本更新概述')).toBeTruthy();
    expect(screen.getByText('上线时间')).toBeTruthy();
    expect(screen.getByText('未填写')).toBeTruthy();
    expect(screen.queryByText('v0.1.1')).toBeNull();
    expect(screen.queryByText('版本状态')).toBeNull();
    expect(screen.queryByText('开发中')).toBeNull();
    expect(screen.queryByText('已上线')).toBeNull();
  });
});
