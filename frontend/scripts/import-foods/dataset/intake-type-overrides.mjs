// Overrides are reserved for a demonstrated semantic exception to the nutrient
// thresholds. Stage 5 currently has no such exception after fixing category use.
export const INTAKE_OVERRIDES = {};

export function getIntakeOverride(externalFoodId) {
  return INTAKE_OVERRIDES[externalFoodId] || null;
}
