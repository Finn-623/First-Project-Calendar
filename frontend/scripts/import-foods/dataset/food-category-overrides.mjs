export const FOOD_OVERRIDES = {
  F001463: ['Bread, from white flour', '12201', 'grains_staples', 'bread', 'Common plain white bread representative'],
  F006456: ['Pasta, white wheat flour, boiled from dry, no added salt', '12401', 'grains_staples', 'pasta', 'Common simply cooked pasta representative'],
  F009034: ['Sweet potato, orange flesh, peeled, fresh, boiled, drained', '24302', 'potatoes_starchy_vegetables', 'sweet_potato', 'Common simply cooked sweet potato representative'],
  F003200: ['Corn, fresh on cob, boiled, drained', '24704', 'potatoes_starchy_vegetables', 'corn', 'Common simply cooked corn representative'],
  F007320: ['Potato, pale skin, peeled, boiled, drained', '24101', 'potatoes_starchy_vegetables', 'potato', 'Common simply cooked potato representative'],
  F009694: ['Yoghurt, natural, regular fat (~3%)', '19201', 'dairy', 'yoghurt', 'Common unflavoured dairy yoghurt representative'],
  F002414: ['Cheese, cheddar, natural, regular fat', '19401', 'dairy', 'cheese', 'Common natural cheddar representative'],
  F002882: ['Chickpea, dried, boiled, drained', '25101', 'legumes_soy', 'chickpeas', 'Common simply cooked chickpea representative'],
  F005177: ['Lentil, dried, boiled, drained', '25101', 'legumes_soy', 'lentils', 'Common simply cooked lentil representative'],
  F009300: ['Tuna, unflavoured, canned in water, drained', '15401', 'fish_seafood', 'tuna', 'Common canned tuna representative'],
  F007433: ['Prawn, flesh, raw (green)', '15201', 'fish_seafood', 'prawns', 'Common raw prawn representative'],
  F001905: ['Broccoli, fresh, raw', '24202', 'vegetables', 'cruciferous_vegetables', 'Common raw broccoli representative'],
  F002276: ['Carrot, mature, peeled, fresh, raw', '24301', 'vegetables', 'root_vegetables', 'Common raw carrot representative'],
  F000262: ['Banana, cavendish, peeled, raw', '16502', 'fruits', 'tropical_fruits', 'Common banana representative'],
  F001290: ['Blueberry, raw', '16201', 'fruits', 'berries', 'Common raw berry representative'],
  F006081: ['Nut, almond, with skin, raw, unsalted', '22204', 'nuts_seeds', 'nuts', 'Common raw unsalted almond representative'],
  F006107: ['Nut, peanut, with skin, raw, unsalted', '22201', 'nuts_seeds', 'nuts', 'Common raw unsalted peanut representative'],
  F006177: ['Oil, olive', '14402', 'oils_fats', 'plant_oils', 'Common olive oil representative'],
  F001971: ['Butter, plain, no added salt', '14101', 'oils_fats', 'animal_fats', 'Common unsalted butter representative'],
  F007879: ['Salt, table, non-iodised', '31301', 'condiments_sauces', 'seasonings', 'Common table salt representative'],
  F008976: ['Sugar, white, granulated or lump', '27101', 'condiments_sauces', 'sweeteners', 'Common white sugar representative'],
  F008065: ['Sauce, soy, commercial', '23102', 'condiments_sauces', 'sauces', 'Common soy sauce representative'],
  F009527: ['Water, tap', '11801', 'beverages_non_alcoholic', 'water', 'Common drinking water representative'],
  F003017: ['Coffee, black, from instant coffee powder', '11201', 'beverages_non_alcoholic', 'coffee', 'Common plain black coffee representative'],
  F009125: ['Tea, regular, black, brewed from leaf or teabags, without milk', '11101', 'beverages_non_alcoholic', 'tea', 'Common plain brewed tea representative']
};

for (const [externalFoodId, values] of Object.entries(FOOD_OVERRIDES)) {
  FOOD_OVERRIDES[externalFoodId] = {
    external_food_id: externalFoodId,
    name_en: values[0],
    source_classification: values[1],
    category_primary: values[2],
    category_secondary: values[3],
    reason: values[4]
  };
}

export function getFoodOverride(externalFoodId) {
  return FOOD_OVERRIDES[externalFoodId] || null;
}
