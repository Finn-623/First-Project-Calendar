import { readFile } from 'node:fs/promises';

async function verify() {
  const selection = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/afcd-initial-selection.json', 'utf8')).selection;
  const portions = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/food-portions.json', 'utf8'));
  
  console.log('--- Verification ---');
  let totalPortions = 0;
  for (const id in portions) {
    totalPortions += portions[id].length;
  }
  console.log(`Food items with portions: ${Object.keys(portions).length}`);
  console.log(`Total portions: ${totalPortions}`);
  
  // Specific check
  const sampleId = Object.keys(portions)[0];
  console.log(`Sample portions for ${sampleId}:`, portions[sampleId]);
}
verify().catch(console.error);
