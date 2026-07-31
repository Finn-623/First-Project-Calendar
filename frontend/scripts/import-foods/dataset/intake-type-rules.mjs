export const ALLOWED_INTAKE_TYPES = ['carbohydrate', 'protein', 'fat', 'fiber'];

export const THRESHOLDS = {
    carbohydrate: { strong: 15, conditional: 8 },
    protein: { strong: 10, conditional: 5 },
    fat: { strong: 10, conditional: 5 },
    fiber: { strong: 3, conditional: 2 }
};

// Rules: [Category]: [Type]: [True if conditional applies]
export const CATEGORY_ADAPTIVE_RULES = {
    grains_staples: { carbohydrate: true, fiber: true },
    potatoes_starchy_vegetables: { carbohydrate: true, fiber: true },
    meat_poultry: { protein: true, fat: true },
    fish_seafood: { protein: true, fat: true },
    eggs: { protein: true, fat: true },
    dairy: { protein: true, carbohydrate: true, fat: true },
    legumes_soy: { protein: true, carbohydrate: true, fiber: true },
    vegetables: { fiber: true },
    fruits: { carbohydrate: true, fiber: true },
    nuts_seeds: { fat: true, protein: true, fiber: true },
    oils_fats: { fat: true },
    condiments_sauces: { carbohydrate: true, fat: true }
};
