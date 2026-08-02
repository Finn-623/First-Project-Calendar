import { readFile, writeFile } from 'node:fs/promises';

async function generate() {
  const selection = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/afcd-initial-selection.json', 'utf8')).selection;
  const translations = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/food-name-translations.json', 'utf8'));
  const intakeTypes = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/food-intake-types.json', 'utf8'));
  const consolidatedFoods = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/public-foods-afcd-initial.json', 'utf8'));
  const portionDecisions = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/portion-review-decisions.json', 'utf8'));

  const foodsMap = new Map(consolidatedFoods.map(f => [f.external_food_id, f]));
  const results = [];

  const ids = Object.keys(selection).sort();

  for (const id of ids) {
    const food = foodsMap.get(id);
    const trans = translations[id];
    const intake = intakeTypes[id] || [];
    const portions = food?.portions || [];
    const heldPortions = portionDecisions.filter(
      (decision) => decision.external_food_id === id && decision.decision !== 'approve'
    );

    const blocking_reasons = [];
    const warning_reasons = [];
    let name_status = 'ok';
    let nutrition_status = 'ok';
    let classification_status = 'ok';
    let intake_type_status = 'ok';
    let alias_status = 'ok';

    // 1. Name & Identity
    if (!trans || trans.translation_status !== 'ready') {
      name_status = 'needs_review';
      blocking_reasons.push('Name needs manual review (Stage 4 constraint)');
    }

    // 2. Nutrition
    if (food) {
      if (food.energy_kcal === null || food.protein_g === null || food.carbohydrate_g === null || food.fat_g === null) {
        nutrition_status = 'needs_review';
        blocking_reasons.push('Missing core macro-nutrients');
      } else {
        if (food.energy_kcal < 0 || food.protein_g < 0 || food.carbohydrate_g < 0 || food.fat_g < 0) {
          nutrition_status = 'needs_review';
          blocking_reasons.push('Negative macro-nutrient values detected');
        }
        
        // Sugar constraints
        if (food.total_sugar_g !== null && food.carbohydrate_g !== null && food.total_sugar_g > food.carbohydrate_g + 0.1) {
          nutrition_status = 'needs_review';
          blocking_reasons.push(`Total sugar (${food.total_sugar_g}g) exceeds carbohydrate (${food.carbohydrate_g}g)`);
        }
        if (food.added_sugar_g !== null && food.total_sugar_g !== null && food.added_sugar_g > food.total_sugar_g + 0.1) {
          nutrition_status = 'needs_review';
          blocking_reasons.push(`Added sugar (${food.added_sugar_g}g) exceeds total sugar (${food.total_sugar_g}g)`);
        }

        // Fat sum check
        const sumFattyAcids = (food.saturated_fat_g || 0) + (food.monounsaturated_fat_g || 0) + (food.polyunsaturated_fat_g || 0);
        if (sumFattyAcids > food.fat_g + 2.0) { // Using 2g tolerance as some data might have small discrepancies or missing components
          nutrition_status = 'needs_review';
          blocking_reasons.push(`Sum of fatty acids (${sumFattyAcids.toFixed(2)}g) significantly exceeds total fat (${food.fat_g}g)`);
        }

        // Energy estimate check (4-4-9-2 rule)
        const estimatedKcal = (food.protein_g * 4) + (food.carbohydrate_g * 4) + (food.fat_g * 9) + ((food.fiber_g || 0) * 2);
        const diff = Math.abs(estimatedKcal - food.energy_kcal);
        if (diff > 50 && diff / (food.energy_kcal || 1) > 0.2 && food.energy_kcal > 10) {
          warning_reasons.push(`Energy deviation: listed ${food.energy_kcal} kcal vs estimated ${estimatedKcal.toFixed(1)} kcal`);
        }
      }
    } else {
      nutrition_status = 'missing_data';
      blocking_reasons.push('Food data missing in consolidated file');
    }

    // 3. Classification
    if (!selection[id].category_primary) {
      classification_status = 'missing';
      blocking_reasons.push('Missing primary category');
    }

    // 4. Intake Types
    if (intake.length === 0) {
      // Small check for low nutrient foods
      if (food && (food.energy_kcal > 50 || food.protein_g > 5 || food.carbohydrate_g > 10 || food.fat_g > 5)) {
          intake_type_status = 'potentially_incomplete';
          warning_reasons.push('Empty intake types for nutrient-dense food');
      }
    }

    // 5. Portions
    // Stage 7 is the publication boundary: imported portions are publishable;
    // excluded/deferred decisions remain held outside the package.
    const ready_portion_count = portions.length;
    const held_portion_count = heldPortions.length;

    // Determine Final Status
    let final_status = 'release_ready';
    if (blocking_reasons.length > 0) {
      if (nutrition_status !== 'ok' || classification_status !== 'ok') {
        final_status = 'needs_data_review';
      } else if (name_status !== 'ok') {
        final_status = 'needs_name_review';
      } else {
        final_status = 'needs_data_review';
      }
    } else {
      if (portions.length === 0) {
        final_status = 'release_ready_without_portion';
      }
    }

    results.push({
      external_id: id,
      final_status,
      blocking_reasons,
      warning_reasons,
      name_status,
      nutrition_status,
      classification_status,
      intake_type_status,
      alias_status,
      ready_portion_count,
      held_portion_count,
      proposed_action: final_status === 'release_ready' || final_status === 'release_ready_without_portion' ? 'approve' : 'hold',
      notes: ''
    });
  }

  const output = JSON.stringify(results, null, 2);
  await writeFile('frontend/scripts/import-foods/dataset/food-release-readiness.json', output);

  // Stats
  const stats = results.reduce((acc, r) => {
    acc[r.final_status] = (acc[r.final_status] || 0) + 1;
    return acc;
  }, {});

  console.log('--- Final Status Stats ---');
  console.log(stats);
  console.log('Total:', results.length);

  const releaseReadyTotal = (stats.release_ready || 0) + (stats.release_ready_without_portion || 0);
  console.log('Total Release Ready:', releaseReadyTotal);

  const readyNames = results.filter(r => translations[r.external_id]?.translation_status === 'ready');
  const readyNamesStats = readyNames.reduce((acc, r) => {
    acc[r.final_status] = (acc[r.final_status] || 0) + 1;
    return acc;
  }, {});
  console.log(`--- ${readyNames.length} Ready Name Status Distribution ---`);
  console.log(readyNamesStats);

  const needsReviewNames = results.filter(r => translations[r.external_id]?.translation_status === 'needs_review');
  const allNeedsReviewBlocked = needsReviewNames.every(r => r.blocking_reasons.length > 0);
  console.log(`All ${needsReviewNames.length} Needs Review names blocked:`, allNeedsReviewBlocked);

  const portionStats = results.reduce((acc, r) => {
    acc.ready += r.ready_portion_count;
    acc.held += r.held_portion_count;
    return acc;
  }, { ready: 0, held: 0 });
  console.log('--- Portion Stats ---');
  console.log(portionStats);
}

generate().catch(console.error);
