import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SettingsIntakePlanPage } from './SettingsIntakePlanPage';
import { useStore } from '../store';

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
    mockStore();
  });

  test('displays edit form with all four fields', async () => {
    render(<SettingsIntakePlanPage />);

    await screen.findByText('编辑摄入计划');
    expect(screen.getByText('填写任意 3 项，第 4 项自动计算')).toBeTruthy();
    expect(screen.getByLabelText('热量')).toBeTruthy();
    expect(screen.getByLabelText('蛋白质')).toBeTruthy();
    expect(screen.getByLabelText('脂肪')).toBeTruthy();
    expect(screen.getByLabelText('碳水')).toBeTruthy();
  });

  test('auto-calculates calories when other three fields are filled', async () => {
    render(<SettingsIntakePlanPage />);

    const caloriesInput = screen.getByLabelText('热量');
    const proteinInput = screen.getByLabelText('蛋白质');
    const fatInput = screen.getByLabelText('脂肪');
    const carbsInput = screen.getByLabelText('碳水');

    fireEvent.change(caloriesInput, { target: { value: '' } });
    fireEvent.change(proteinInput, { target: { value: '150' } });
    fireEvent.change(fatInput, { target: { value: '60' } });
    fireEvent.change(carbsInput, { target: { value: '150' } });

    await waitFor(() => {
      expect(caloriesInput.readOnly).toBe(true);
      // 150*4 + 60*9 + 150*4 = 600 + 540 + 600 = 1740
      expect(caloriesInput.value).toBe('1740');
    });
  });

  test('auto-calculates protein when calories, fat, and carbs are filled', async () => {
    render(<SettingsIntakePlanPage />);

    const caloriesInput = screen.getByLabelText('热量');
    const proteinInput = screen.getByLabelText('蛋白质');
    const fatInput = screen.getByLabelText('脂肪');
    const carbsInput = screen.getByLabelText('碳水');

    fireEvent.change(caloriesInput, { target: { value: '2000' } });
    fireEvent.change(proteinInput, { target: { value: '' } });
    fireEvent.change(fatInput, { target: { value: '60' } });
    fireEvent.change(carbsInput, { target: { value: '150' } });

    await waitFor(() => {
      expect(proteinInput.readOnly).toBe(true);
    });
  });

  test('shows error when not exactly one field is empty', async () => {
    render(<SettingsIntakePlanPage />);

    const caloriesInput = screen.getByLabelText('热量');
    const proteinInput = screen.getByLabelText('蛋白质');
    const fatInput = screen.getByLabelText('脂肪');

    fireEvent.change(caloriesInput, { target: { value: '' } });
    fireEvent.change(proteinInput, { target: { value: '' } });
    fireEvent.change(fatInput, { target: { value: '60' } });

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.getByText('请填写其中任意 3 项，第 4 项将自动计算')).toBeTruthy();
    });
  });

  test('cancel clears changes and restores original values', async () => {
    render(<SettingsIntakePlanPage />);

    const caloriesInput = screen.getByLabelText('热量');
    fireEvent.change(caloriesInput, { target: { value: '2500' } });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    await waitFor(() => {
      expect(caloriesInput.value).toBe('2000');
    });
  });

  test('saves plan with auto-calculated field when changed', async () => {
    render(<SettingsIntakePlanPage />);

    const caloriesInput = screen.getByLabelText('热量');
    const proteinInput = screen.getByLabelText('蛋白质');
    const fatInput = screen.getByLabelText('脂肪');
    const carbsInput = screen.getByLabelText('碳水');

    // Clear carbs to trigger auto-calculation
    fireEvent.change(caloriesInput, { target: { value: '2500' } });
    fireEvent.change(proteinInput, { target: { value: '200' } });
    fireEvent.change(fatInput, { target: { value: '70' } });
    fireEvent.change(carbsInput, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(savePlanMock).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          calories: 2500,
          protein: 200,
          fat: 70,
        }),
        undefined,
        'calories'
      );
    });
  });

  test('does not send save when plan is unchanged', async () => {
    render(<SettingsIntakePlanPage />);

    const caloriesInput = screen.getByLabelText('热量');
    fireEvent.change(caloriesInput, { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(savePlanMock).not.toHaveBeenCalled();
    });
  });
});
