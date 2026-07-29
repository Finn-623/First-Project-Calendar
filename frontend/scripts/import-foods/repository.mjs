import { createClient } from '@supabase/supabase-js';

function assertResult(error, operation) {
  if (error) {
    const wrapped = new Error(`${operation} failed: ${error.message}`);
    wrapped.code = error.code || 'DATABASE_ERROR';
    throw wrapped;
  }
}

export function createSupabaseImportRepository({ supabaseUrl, serviceRoleKey }) {
  if (!supabaseUrl) throw new Error('SUPABASE_URL is required for a write import');
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for a write import');
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async startRun({ sourceName, inputIdentifier, totalCount, batchSize }) {
      const { data, error } = await client
        .from('food_import_runs')
        .insert({
          source_name: sourceName,
          input_identifier: inputIdentifier,
          status: 'running',
          total_count: totalCount,
          executor_role: 'service_role',
          metadata: { batch_size: batchSize },
        })
        .select('id')
        .single();
      assertResult(error, 'start import audit');
      return data.id;
    },

    async findExistingKeys(sourceName, externalIds, batchSize) {
      const keys = new Set();
      for (let offset = 0; offset < externalIds.length; offset += batchSize) {
        const ids = externalIds.slice(offset, offset + batchSize);
        if (ids.length === 0) continue;
        const { data, error } = await client
          .from('foods')
          .select('source_name,external_food_id')
          .eq('visibility', 'public')
          .eq('source_name', sourceName)
          .in('external_food_id', ids);
        assertResult(error, 'load existing food identities');
        for (const row of data || []) {
          keys.add(`${row.source_name}\u0000${row.external_food_id}`);
        }
      }
      return keys;
    },

    async importFoodAtomic(importRunId, food) {
      const { data, error } = await client.rpc('import_public_food_item', {
        p_import_run_id: importRunId,
        p_food: {
          source_name: food.source_name,
          external_food_id: food.external_food_id,
          name_zh: food.name_zh,
          name_en: food.name_en,
          brand: food.brand,
          preparation_state: food.preparation_state,
          category_primary: food.category_primary,
          category_secondary: food.category_secondary,
          intake_types: food.intake_types,
          energy_kcal: food.energy_kcal,
          protein_g: food.protein_g,
          carbohydrate_g: food.carbohydrate_g,
          fat_g: food.fat_g,
          fiber_g: food.fiber_g,
          saturated_fat_g: food.saturated_fat_g,
          monounsaturated_fat_g: food.monounsaturated_fat_g,
          polyunsaturated_fat_g: food.polyunsaturated_fat_g,
          trans_fat_g: food.trans_fat_g,
          total_sugar_g: food.total_sugar_g,
          added_sugar_g: food.added_sugar_g,
          sugar_alcohol_g: food.sugar_alcohol_g,
          sodium_mg: food.sodium_mg,
          potassium_mg: food.potassium_mg,
        },
        p_portions: food.portions,
        p_aliases: food.aliases,
      });
      assertResult(error, 'import food atomically');
      return data;
    },

    async recordErrors(errors, batchSize) {
      for (let offset = 0; offset < errors.length; offset += batchSize) {
        const batch = errors.slice(offset, offset + batchSize);
        if (batch.length === 0) continue;
        const { error } = await client.from('food_import_errors').insert(batch);
        assertResult(error, 'record import errors');
      }
    },

    async finishRun(importRunId, summary) {
      const { error } = await client
        .from('food_import_runs')
        .update({
          status: summary.status,
          success_count: summary.success,
          skipped_count: summary.skipped,
          failed_count: summary.failed,
          completed_at: new Date().toISOString(),
          error_summary:
            summary.failed > 0 ? `${summary.failed} row(s) failed; see error audit` : null,
        })
        .eq('id', importRunId);
      assertResult(error, 'finish import audit');
    },
  };
}
