import { CATEGORIES, getCategory, AFCD_MAPPING } from './category-mapping.mjs';

const testCases = [
    { classId: '18302', expected: 'meat_poultry' },
    { classId: '17101', expected: 'eggs' },
    { classId: '29201', expected: 'excluded' },
    { classId: '99999', expected: 'needs_review' }
];

console.log('Running classification mapping tests...');
for (const tc of testCases) {
    const result = getCategory(tc.classId, 'test food');
    if (result !== tc.expected) {
        console.error(`Test failed for ${tc.classId}: expected ${tc.expected}, got ${result}`);
        process.exit(1);
    }
}

// Validate all categories are allowed
const allowed = Object.keys(CATEGORIES);
for (const cat of Object.values({ ...AFCD_MAPPING, 'needs_review': 'needs_review' })) {
    if (!allowed.includes(cat)) {
        console.error(`Invalid category found: ${cat}`);
        process.exit(1);
    }
}

console.log('All tests passed!');
