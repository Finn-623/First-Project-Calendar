import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import * as XLSX from 'xlsx';

const KJ_TO_KCAL = 1 / 4.184;

async function readExcelSheet(filePath, sheetName, headerRowIndex = 2) {
  const buf = await readFile(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer' });
  if (!workbook.SheetNames.includes(sheetName)) {
    throw new Error(`Sheet ${sheetName} not found in ${filePath}`);
  }
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
  return jsonData;
}

function parseNullableNumber(value, factor = 1) {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
  return isNaN(num) ? null : Number((num * factor).toFixed(4));
}

function determinePreparationState(name) {
  const lower = name.toLowerCase();
  const rawKeywords = ['raw', 'uncooked'];
  const cookedKeywords = ['cooked', 'boiled', 'baked', 'roasted', 'fried', 'grilled', 'steamed', 'stewed', 'poached', 'microwaved'];
  
  const hasRaw = rawKeywords.some(k => lower.includes(k));
  const hasCooked = cookedKeywords.some(k => lower.includes(k));
  
  if (hasRaw && !hasCooked) return 'raw';
  if (hasCooked && !hasRaw) return 'cooked';
  return 'unspecified';
}

export async function convertAfcd(foodDetailsPath, nutrientProfilesPath, outputPath) {
  console.log('Reading AFCD Excel files...');
  const details = await readExcelSheet(foodDetailsPath, 'Food details', 2);
  const profiles = await readExcelSheet(nutrientProfilesPath, 'All solids & liquids per 100 g', 2);
  
  console.log(`Details rows: ${details.length}, Profiles rows: ${profiles.length}`);
  
  const profilesMap = new Map(profiles.map(row => [row['Public Food Key'], row]));
  const normalized = [];
  
  for (const detail of details) {
    const key = detail['Public Food Key'];
    const profile = profilesMap.get(key);
    
    if (!profile) throw new Error(`Missing profile for key: ${key}`);
    
    const nameEn = detail['Food Name'];
    
    normalized.push({
      source_name: 'AFCD',
      external_food_id: key,
      name_en: nameEn,
      source_classification: detail['Classification'],
      source_derivation: detail['Derivation'],
      source_description: detail['Food Description'],
      analysed_portion: detail['Analysed Portion'],
      preparation_state: determinePreparationState(nameEn),
      energy_kcal: parseNullableNumber(profile['Energy with dietary fibre, equated \r\n(kJ)'], KJ_TO_KCAL),
      protein_g: parseNullableNumber(profile['Protein \r\n(g)']),
      carbohydrate_g: parseNullableNumber(profile['Available carbohydrate, with sugar alcohols \r\n(g)']),
      fat_g: parseNullableNumber(profile['Fat, total \r\n(g)']),
      fiber_g: parseNullableNumber(profile['Total dietary fibre \r\n(g)']),
      saturated_fat_g: parseNullableNumber(profile['Total saturated fatty acids, equated \r\n(g)']),
      monounsaturated_fat_g: parseNullableNumber(profile['Total monounsaturated fatty acids, equated \r\n(g)']),
      polyunsaturated_fat_g: parseNullableNumber(profile['Total polyunsaturated fatty acids, equated \r\n(g)']),
      trans_fat_g: parseNullableNumber(profile['Total trans fatty acids, imputed \r\n(mg)'], 0.001),
      total_sugar_g: parseNullableNumber(profile['Total sugars (g)']),
      added_sugar_g: parseNullableNumber(profile['Added sugars (g)']),
      sugar_alcohol_g: null,
      sodium_mg: parseNullableNumber(profile['Sodium (Na) \r\n(mg)']),
      potassium_mg: parseNullableNumber(profile['Potassium (K) \r\n(mg)']),
    });
  }
  
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(normalized.sort((a, b) => a.external_food_id.localeCompare(b.external_food_id)), null, 2));
  return normalized.length;
}
