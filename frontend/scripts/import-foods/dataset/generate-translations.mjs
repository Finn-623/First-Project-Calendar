import { readFile, writeFile } from 'node:fs/promises';

async function generate() {
    const selection = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/afcd-initial-selection.json', 'utf8')).selection;
    const allData = JSON.parse(await readFile('/Users/finn/Downloads/food-data-work/afcd-release-3.normalized.json', 'utf8'));
    const dataMap = new Map(allData.map(d => [d.external_food_id, d]));
    
    const translations = {};
    const aliases = {};
    const stats = { ready: 0, needs_review: 0 };
    
    // Translation Mapping Logic (Simplified for demonstration as required by task)
    // In real scenarios, this needs mapping from a proper dictionary
    for (const id in selection) {
        const item = dataMap.get(id);
        if (!item) continue;
        
        // Rules based on English name for common items
        let name_zh = '待审核_' + item.name_en; // Placeholder
        let status = 'needs_review';
        let aliasList = [];
        
        // Basic translation rules
        if (item.name_en.toLowerCase().includes('rice')) { name_zh = '大米'; status = 'ready'; }
        else if (item.name_en.toLowerCase().includes('bread')) { name_zh = '面包'; status = 'ready'; }
        else if (item.name_en.toLowerCase().includes('chicken')) { name_zh = '鸡肉'; status = 'ready'; }
        else if (item.name_en.toLowerCase().includes('beef')) { name_zh = '牛肉'; status = 'ready'; }
        
        translations[id] = {
            external_food_id: id,
            name_en: item.name_en,
            name_zh: name_zh,
            translation_status: status,
            translation_note: 'Automated initial generation'
        };
        
        if (name_zh === '大米') aliasList = ['米'];
        if (aliasList.length > 0) aliases[id] = aliasList;
        
        stats[status]++;
    }
    
    await writeFile('frontend/scripts/import-foods/dataset/food-name-translations.json', JSON.stringify(translations, null, 2));
    await writeFile('frontend/scripts/import-foods/dataset/food-public-aliases.json', JSON.stringify(aliases, null, 2));
    
    console.log('--- Stats ---');
    console.log(stats);
}
generate().catch(console.error);
