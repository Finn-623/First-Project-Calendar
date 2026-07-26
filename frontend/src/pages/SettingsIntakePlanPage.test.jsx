import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SettingsIntakePlanPage } from './SettingsIntakePlanPage';
import { useStore } from '../store';
import { intakePlanService } from '../services/intakePlanService';

jest.mock('../components/settings/SettingsSubpageHeader', () => ({
  SettingsSubpageHeader: ({ title, description }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

jest.mock('../store', () => ({
  useStore: jest.fn(),
}));

jest.mock('../services/intakePlanService', () => ({
  intakePlanService: {
    listHistory: jest.fn(),
  },
}));

const savePlanMock = jest.fn();
const loadPlanMock = jest.fn();

function mockStore(overrides = {}) {
  useStore.mockReturnValue({
    user: { id: 'user-1' },
    plan: {
      calories: 2000,
      protein: 180,
      fat: 60,
      carbs: 185,
      calculatedField: 'calories',
    },
    loadPlan: loadPlanMock,
    savePlan: savePlanMock,
    ...overrides,
  });
}

describe('SettingsIntakePlanPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadPlanMock.mockResolvedValue({ success: true, data: null });
    savePlanMock.mockResolvedValue({ success: true, data: null });
    intakePlanService.listHistory.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'h1',
          calories: 2000,
          protein: 180,
          fat: 60,
          carbs: 185,
          calculatedField: 'calories',
          createdAt: '2026-07-26T10:00:00.000Z',
        },
      ],
      hasMore: false,
      nextCursor: null,
    });
    mockStore();
  });

  test('shows current intake plan by default', async () => {
    render(<SettingsIntakePlanPage />);

    expect(screen.getByText('当前摄入计划')).toBeTruthy();
    expect(await screen.findByText('2000 kcal')).toBeTruthy();
  });

  test('enters edit mode and allows selecting one auto-calculated field', async () => {
    render(<SettingsIntakePlanPage />);
    await screen.findByText('2000 kcal');

    fireEvent.click(screen.getByRole('button', { name: '编辑计划' }));
    expect(screen.getByText('选择一项自动计算，其余三项由你填写。')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '自动计算蛋白质' }));
    const proteinInput = screen.getByLabelText('蛋白质');
    expect(proteinInput.readOnly).toBe(true);
  });

  test('cancel restores view mode', async () => {
    render(<SettingsIntakePlanPage />);
    await screen.findByText('2000 kcal');

    fireEvent.click(screen.getByRole('button', { name: '编辑计划' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.getByRole('button', { name: '编辑计划' })).toBeTruthy();
  });

  test('does not send save request when plan is unchanged', async () => {
    render(<SettingsIntakePlanPage />);
    await screen.findByText('2000 kcal');

    fireEvent.click(screen.getByRole('button', { name: '编辑计划' }));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(savePlanMock).not.toHaveBeenCalled();
    });
  });

  test('loads history with default page size 5 and supports loading more', async () => {
    intakePlanService.listHistory
      .mockResolvedValueOnce({
        success: true,
        data: [
          { id: 'h1', calories: 2000, protein: 180, fat: 60, carbs: 185, calculatedField: 'calories', createdAt: '2026-07-26T10:00:00.000Z' },
          { id: 'h2', calories: 2100, protein: 180, fat: 60, carbs: 210, calculatedField: 'calories', createdAt: '2026-07-25T10:00:00.000Z' },
          { id: 'h3', calories: 1900, protein: 170, fat: 58, carbs: 170, calculatedField: 'calories', createdAt: '2026-07-24T10:00:00.000Z' },
          { id: 'h4', calories: 1800, protein: 165, fat: 55, carbs: 165, calculatedField: 'calories', createdAt: '2026-07-23T10:00:00.000Z' },
          { id: 'h5', calories: 1750, protein: 160, fat: 52, carbs: 160, calculatedField: 'calories', createdAt: '2026-07-22T10:00:00.000Z' },
        ],
        hasMore: true,
        nextCursor: '2026-07-22T10:00:00.000Z',
      })
      .mockResolvedValueOnce({
        success: true,
        data: [
          { id: 'h6', calories: 1700, protein: 155, fat: 50, carbs: 155, calculatedField: 'calories', createdAt: '2026-07-21T10:00:00.000Z' },
        ],
        hasMore: false,
        nextCursor: null,
      });

    render(<SettingsIntakePlanPage />);

    await screen.findByText('当前计划');
    expect(intakePlanService.listHistory).toHaveBeenCalledWith({ userId: 'user-1', limit: 5, cursor: null });

    fireEvent.click(await screen.findByRole('button', { name: '查看更多' }));

    await waitFor(() => {
      expect(intakePlanService.listHistory).toHaveBeenLastCalledWith({ userId: 'user-1', limit: 5, cursor: '2026-07-22T10:00:00.000Z' });
    });
  });
});
