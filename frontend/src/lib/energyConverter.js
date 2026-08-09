export const KJ_PER_KCAL = 4.184;

export const convertEnergy = (value, fromUnit, toUnit) => {
  if (value === null || value === undefined || value === '') return value;
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return value;

  if (fromUnit === toUnit) return numValue;

  if (fromUnit === 'kcal' && toUnit === 'kJ') {
    return parseFloat((numValue * KJ_PER_KCAL).toFixed(1));
  }
  if (fromUnit === 'kJ' && toUnit === 'kcal') {
    return parseFloat((numValue / KJ_PER_KCAL).toFixed(1));
  }
  return numValue;
};

export const formatEnergyDisplay = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const num = parseFloat(value);
    return isNaN(num) ? '' : num.toString();
};
