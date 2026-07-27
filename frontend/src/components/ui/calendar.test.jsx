import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Calendar } from './calendar';

jest.mock('./button', () => ({
  buttonVariants: () => 'calendar-button',
}));

describe('Calendar with React 19 compatible react-day-picker', () => {
  test('renders, selects a date and navigates months', () => {
    const onSelect = jest.fn();
    render(
      <Calendar
        mode="single"
        defaultMonth={new Date(2026, 6, 1)}
        selected={new Date(2026, 6, 27)}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole('gridcell', { name: '15' }));
    expect(onSelect).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Next Month/i }));
    expect(screen.getByText(/August 2026/i)).toBeTruthy();
  });
});
