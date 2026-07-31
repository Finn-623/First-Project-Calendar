import { readFile } from 'node:fs/promises';

async function verify() {
  const selection = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/afcd-initial-selection.json', 'utf8')).selection;
  const translations = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/food-name-translations.json', 'utf8'));
  
  console.log('--- Verification ---');
  console.log(`Translations count: ${Object.keys(translations).length}`);
  console.log(`Selection count: ${Object.keys(selection).length}`);
  
  if (Object.keys(translations).length !== 400) console.error('Count mismatch');
  
  // Check common foods
  const commonFoods = ['rice', 'bread', 'chicken', 'beef'];
  for (const cf of commonFoods) {
      let found = false;
      for (const id in selection) {
          const trans = translations[id];
          if (trans.name_en.toLowerCase().includes(cf)) {
              console.log(`Found: ${cf} -> ${trans.name_zh} (${id})`);
              found = true;
              break;
          }
      }
      if (!found) console.log(`Missing common food in translation: ${cf}`);
  }
}
verify().catch(console.error);
