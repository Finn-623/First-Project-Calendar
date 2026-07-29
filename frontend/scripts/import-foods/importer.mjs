import { basename } from 'node:path';
import {
  FoodImportError,
  importKey,
  safeRowSummary,
  validateImportFood,
} from './model.mjs';

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function auditError(importRunId, failure) {
  return {
    import_run_id: importRunId,
    row_number: failure.rowNumber,
    external_food_id: failure.externalFoodId,
    error_code: failure.code,
    error_message: failure.message,
    raw_summary: failure.rawSummary,
  };
}

function finalStatus(summary) {
  if (summary.failed === 0) return 'completed';
  if (summary.success > 0 || summary.skipped > 0) return 'partially_failed';
  return 'failed';
}

export async function runFoodImport({
  adapter,
  inputPath,
  dryRun = false,
  batchSize = 50,
  repository = null,
}) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new FoodImportError(
      'INVALID_BATCH_SIZE',
      'batch size must be an integer between 1 and 100'
    );
  }
  if (!dryRun && !repository) {
    throw new FoodImportError('MISSING_REPOSITORY', 'write import requires a repository');
  }

  const rows = await adapter.readRows(inputPath);
  const candidates = [];
  const failures = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    try {
      const food = adapter.adapt(row);
      const validationErrors = validateImportFood(food);
      if (validationErrors.length > 0) {
        failures.push({
          rowNumber,
          externalFoodId: food.external_food_id,
          code: 'VALIDATION_ERROR',
          message: validationErrors
            .map((error) => `${error.code}: ${error.message}`)
            .join('; '),
          rawSummary: safeRowSummary(row, food.external_food_id),
        });
        return;
      }
      candidates.push({ rowNumber, row, food });
    } catch (error) {
      failures.push({
        rowNumber,
        externalFoodId: safeRowSummary(row).external_food_id,
        code: error.code || 'PARSE_ERROR',
        message: error.message,
        rawSummary: safeRowSummary(row),
      });
    }
  });

  const summary = {
    source: adapter.sourceName,
    input: basename(inputPath),
    dryRun,
    total: rows.length,
    success: 0,
    skipped: 0,
    failed: failures.length,
    status: 'running',
  };

  const seenInputKeys = new Set();
  const uniqueCandidates = [];
  for (const candidate of candidates) {
    const key = importKey(candidate.food);
    if (seenInputKeys.has(key)) {
      summary.skipped += 1;
      continue;
    }
    seenInputKeys.add(key);
    uniqueCandidates.push(candidate);
  }

  if (dryRun) {
    summary.success = uniqueCandidates.length;
    summary.status = finalStatus(summary);
    return { summary, failures };
  }

  const importRunId = await repository.startRun({
    sourceName: adapter.sourceName,
    inputIdentifier: basename(inputPath),
    totalCount: rows.length,
    batchSize,
  });

  try {
    const existingKeys = await repository.findExistingKeys(
      adapter.sourceName,
      uniqueCandidates.map(({ food }) => food.external_food_id),
      batchSize
    );
    const pendingCandidates = [];
    for (const candidate of uniqueCandidates) {
      if (existingKeys.has(importKey(candidate.food))) {
        summary.skipped += 1;
      } else {
        pendingCandidates.push(candidate);
      }
    }

    for (const batch of chunk(pendingCandidates, batchSize)) {
      const results = await Promise.allSettled(
        batch.map(({ food }) => repository.importFoodAtomic(importRunId, food))
      );
      results.forEach((result, index) => {
        const candidate = batch[index];
        if (result.status === 'fulfilled' && result.value?.status === 'success') {
          summary.success += 1;
        } else if (result.status === 'fulfilled' && result.value?.status === 'skipped') {
          summary.skipped += 1;
        } else {
          const reason =
            result.status === 'rejected'
              ? result.reason
              : new Error('database returned an unsupported import status');
          failures.push({
            rowNumber: candidate.rowNumber,
            externalFoodId: candidate.food.external_food_id,
            code: reason.code || 'DATABASE_ERROR',
            message: reason.message,
            rawSummary: safeRowSummary(candidate.row, candidate.food.external_food_id),
          });
          summary.failed += 1;
        }
      });
    }

    if (failures.length > 0) {
      await repository.recordErrors(
        failures.map((failure) => auditError(importRunId, failure)),
        batchSize
      );
    }
    summary.status = finalStatus(summary);
    await repository.finishRun(importRunId, summary);

    return { summary, failures, importRunId };
  } catch (error) {
    summary.failed = Math.max(
      summary.failed,
      summary.total - summary.success - summary.skipped
    );
    summary.status = 'failed';
    try {
      await repository.finishRun(importRunId, summary);
    } catch {
      // Preserve the original database/import failure for the caller.
    }
    throw error;
  }
}
