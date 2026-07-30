import { readFile, writeFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { translateLabel } from './portion-label-rules.mjs';

async function generatePortions() {
  const selection = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/afcd-initial-selection.json', 'utf8')).selection;
  
  // Load AUSNUT
  const buf = await readFile('/Users/finn/Downloads/AUSNUT 2023 - Food measures.xlsx');
  const workbook = XLSX.read(buf, { type: 'buffer' });
  const ausnutRows = XLSX.utils.sheet_to_json(workbook.Sheets['AUSNUT 2023'], { range: 2 }); // Header at row 3

  const foodPortions = {};
  const stats = { exactMatches: 0, retainedPortions: 0 };
  
  // Group AUSNUT by 'Public food key'
  const ausnutMap = new Map();
  for (const row of ausnutRows) {
    const key = String(row['Public food key']);
    if (!ausnutMap.has(key)) ausnutMap.set(key, []);
    ausnutMap.get(key).push(row);
  }
  
  for (const id in selection) {
    const key = id; 
    if (ausnutMap.has(key)) {
      stats.exactMatches++;
      const measures = ausnutMap.get(key);
      const portions = [];
      
      for (const m of measures) {
        const grams = parseFloat(m['Gram amount']);
        if (isNaN(grams) || grams <= 0) continue;
        
        // Filter out density or other non-descriptive measures
        const descriptor1 = (m['Descriptor 1\r\n'] || '').toLowerCase();
        if (descriptor1.includes('density')) continue;
        
        const label_en = `${m['Quantity']} ${descriptor1}`.trim();
        
        portions.push({
            external_food_id: id,
            portion_name: translateLabel(label_en),
            grams: grams,
            is_default: portions.length === 0,
            review_status: 'ready'
        });
        stats.retainedPortions++;
      }
      if (portions.length > 0) foodPortions[id] = portions;
    }
  }
  
  await writeFile('frontend/scripts/import-foods/dataset/food-portions.json', JSON.stringify(foodPortions, null, 2));
  console.log('--- Stats ---');
  console.log(stats);
}

generatePortions().catch(console.error);
