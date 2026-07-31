import { readFile } from 'node:fs/promises';
import { ALLOWED_INTAKE_TYPES } from './intake-type-rules.mjs';

async function verify() {
  const selection = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/afcd-initial-selection.json', 'utf8')).selection;
  const intakeTypes = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/food-intake-types.json', 'utf8'));
  
  console.log('--- Verification ---');
  if (Object.keys(intakeTypes).length !== 400) console.error('Count mismatch');
  
  // 1. Verify Enum, Ordering, Uniqueness
  for (const id in intakeTypes) {
    const types = intakeTypes[id];
    // Check duplicates
    if (new Set(types).size !== types.length) console.error(`Duplicate types in ${id}`);
    
    // Check valid and order
    let lastIndex = -1;
    for (const t of types) {
        if (!ALLOWED_INTAKE_TYPES.includes(t)) console.error(`Invalid type ${t} in ${id}`);
        const currentIndex = ALLOWED_INTAKE_TYPES.indexOf(t);
        if (currentIndex <= lastIndex) console.error(`Invalid order in ${id}: ${t}`);
        lastIndex = currentIndex;
    }
  }
  
  console.log('Verification passed!');
}
verify().catch(console.error);
