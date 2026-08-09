import { convertEnergy } from './energyConverter';

describe('energyConverter', () => {
  test('converts 100 kcal to 418.4 kJ', () => {
    expect(convertEnergy(100, 'kcal', 'kJ')).toBe(418.4);
  });

  test('converts 418.4 kJ to 100 kcal', () => {
    expect(convertEnergy(418.4, 'kJ', 'kcal')).toBe(100);
  });

  test('converts 500 kcal to kJ and back', () => {
    const kj = convertEnergy(500, 'kcal', 'kJ');
    expect(convertEnergy(kj, 'kJ', 'kcal')).toBe(500);
  });

  test('handles empty input', () => {
    expect(convertEnergy('', 'kcal', 'kJ')).toBe('');
  });

  test('handles invalid input', () => {
    expect(convertEnergy('abc', 'kcal', 'kJ')).toBe('abc');
  });
});
