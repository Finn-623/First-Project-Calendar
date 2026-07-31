import { readFile, writeFile } from 'node:fs/promises';
import { ALLOWED_INTAKE_TYPES, THRESHOLDS, CATEGORY_ADAPTIVE_RULES } from './intake-type-rules.mjs';

async function generateIntakeTypes() {
  const allData = JSON.parse(await readFile('/Users/finn/Downloads/food-data-work/afcd-release-3.normalized.json', 'utf8'));
  const selectionData = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/afcd-initial-selection.json', 'utf8'));
  const selection = selectionData.selection;
  const dataMap = new Map(allData.map(d => [d.external_food_id, d]));
  
  const intakeTypesMap = {};
  const stats = { 
      total: 0, 
      combinations: {}, 
      counts: { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 }, 
      mapped: 0,
      empty: { count: 0, reasons: {} }
  };

  for (const id in selection) {
    const item = dataMap.get(id);
    if (!item) continue;
    
    const cat = selection[id].category_primary;
    
    // Rule-based logic
    const types = new Set();
    const rules = CATEGORY_ADAPTIVE_RULES[cat] || {};
    
    for (const type of ALLOWED_INTAKE_TYPES) {
        const val = item[`${type}_g`] || 0;
        const threshold = THRESHOLDS[type];
        
        if (val >= threshold.strong) {
            types.add(type);
        } else if (rules[type] && val >= threshold.conditional) {
            types.add(type);
        }
    }
    
    // Order types: carbohydrate -> protein -> fat -> fiber
    const sortedTypes = ALLOWED_INTAKE_TYPES.filter(t => types.has(t));
    intakeTypesMap[id] = sortedTypes;
    
    // Stats
    stats.total++;
    const combo = sortedTypes.join(',');
    stats.combinations[combo] = (stats.combinations[combo] || 0) + 1;
    stats.counts[sortedTypes.length] = (stats.counts[sortedTypes.length] || 0) + 1;
    
    if (sortedTypes.length === 0) {
        stats.empty.count++;
        const reason = `${cat || 'unknown_cat'}`;
        stats.empty.reasons[reason] = (stats.empty.reasons[reason] || 0) + 1;
    }
  }
  
  await writeFile('frontend/scripts/import-foods/dataset/food-intake-types.json', JSON.stringify(intakeTypesMap, null, 2));
  
  console.log('--- Stats ---');
  console.log('Total:', stats.total);
  console.log('Combinations:', stats.combinations);
  console.log('Count distribution:', stats.counts);
  console.log('Empty types reasons:', stats.empty.reasons);
}

generateIntakeTypes().catch(console.error);
