import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildTranslationData } from './generate-translations.mjs';

const SOURCE_PATH = '/Users/finn/Downloads/food-data-work/afcd-release-3.normalized.json';
const SELECTION_PATH = 'frontend/scripts/import-foods/dataset/afcd-initial-selection.json';
const TRANSLATION_PATH = 'frontend/scripts/import-foods/dataset/food-name-translations.json';
const ALIAS_PATH = 'frontend/scripts/import-foods/dataset/food-public-aliases.json';

const source = JSON.parse(await readFile(SOURCE_PATH, 'utf8'));
const selectionDocument = JSON.parse(await readFile(SELECTION_PATH, 'utf8'));
const selection = selectionDocument.selection;
const translations = JSON.parse(await readFile(TRANSLATION_PATH, 'utf8'));
const aliases = JSON.parse(await readFile(ALIAS_PATH, 'utf8'));
const sourceById = new Map(source.map((food) => [food.external_food_id, food]));
const ids = Object.keys(selection);

assert.equal(ids.length, 400);
assert.equal(Object.keys(translations).length, 400);
assert.equal(Object.keys(aliases).length, 400);
assert.deepEqual(Object.keys(translations), ids, 'translation order and IDs');
assert.deepEqual(Object.keys(aliases), ids, 'alias order and IDs');
assert.equal(new Set(ids).size, 400);

const aliasCanonical = new Map([
  ['西红柿', '番茄'], ['马铃薯', '土豆'], ['洋芋', '土豆'],
  ['番薯', '红薯'], ['地瓜', '红薯'], ['甜椒', '彩椒'], ['灯笼椒', '彩椒'],
  ['芝士', '奶酪'], ['优格', '酸奶'], ['意面', '意大利面'], ['鸡豆', '鹰嘴豆'],
  ['绿花椰菜', '西兰花'], ['落花生', '花生'], ['苞米', '玉米'], ['鲔鱼', '金枪鱼'],
  ['虾仁', '虾仁']
]);

for (const id of ids) {
  const sourceFood = sourceById.get(id);
  const translation = translations[id];
  assert.ok(sourceFood, `source record ${id}`);
  assert.equal(translation.external_food_id, id);
  assert.equal(translation.name_en, sourceFood.name_en, `${id} source English`);
  assert.ok(translation.name_zh.trim(), `${id} Chinese name`);
  assert.notEqual(translation.name_zh, translation.name_en, `${id} copied English`);
  assert.equal(translation.name_zh.startsWith(translation.name_en), false);
  assert.doesNotMatch(translation.name_zh, /[A-Za-z]{2,}/, `${id} English word`);
  assert.ok(['ready', 'needs_review'].includes(translation.translation_status));
  assert.ok(['generated', 'manual', 'manual_override'].includes(translation.translation_source));
  if (translation.translation_status === 'needs_review') {
    assert.ok(translation.translation_note?.length >= 12, `${id} review note`);
    assert.notEqual(translation.translation_note, '自动翻译待检查');
  }

  assert.ok(Array.isArray(aliases[id]), `${id} aliases array`);
  assert.equal(new Set(aliases[id]).size, aliases[id].length, `${id} unique aliases`);
  for (const alias of aliases[id]) {
    assert.ok(alias.trim(), `${id} nonempty alias`);
    assert.notEqual(alias, translation.name_zh, `${id} alias differs from main name`);
    const canonical = aliasCanonical.get(alias);
    assert.ok(canonical && translation.name_zh.includes(canonical), `${id} alias semantics`);
  }

  const english = sourceFood.name_en.toLowerCase();
  if (/\b(raw|uncooked)\b/.test(english) && id !== 'F008973') {
    assert.match(translation.name_zh, /生|未烹调/, `${id} raw state`);
  }
  if (/\bunpeeled\b|\bwith skin\b/.test(english)) assert.match(translation.name_zh, /带皮/, `${id} skin retained`);
  if (/\bpeeled\b|\bwithout skin\b/.test(english)) assert.match(translation.name_zh, /去皮/, `${id} peeled retained`);
  if (/\bregular fat\b/.test(english)) assert.match(translation.name_zh, /全脂/, `${id} regular fat retained`);
  if (/\breduced fat\b/.test(english)) assert.match(translation.name_zh, /低脂/, `${id} reduced fat retained`);
  if (/\bskim\b/.test(english)) assert.match(translation.name_zh, /脱脂/, `${id} skim retained`);
  if (/\bcanned in water\b/.test(english)) assert.match(translation.name_zh, /水浸/, `${id} water-packed retained`);
  if (/\bdrained\b/.test(english)) assert.match(translation.name_zh, /沥干/, `${id} drained retained`);
}

const duplicateNames = new Map();
for (const translation of Object.values(translations)) {
  const group = duplicateNames.get(translation.name_zh) || [];
  group.push(translation);
  duplicateNames.set(translation.name_zh, group);
}
for (const [name, group] of duplicateNames) {
  if (group.length > 1) {
    assert.ok(group.every((item) => item.translation_status === 'needs_review'), `ready duplicate Chinese name: ${name}`);
    assert.ok(group.every((item) => item.translation_note));
  }
}

const commonChecks = new Map([
  ['F007661', '白米饭'], ['F001463', '白面包'], ['F006143', '燕麦片'],
  ['F006456', '意大利面'], ['F007320', '土豆'], ['F009034', '红薯'],
  ['F002594', '鸡胸肉'], ['F000561', '牛肉'], ['F007827', '三文鱼'],
  ['F003729', '鸡蛋'], ['F005634', '牛奶'], ['F009694', '酸奶'],
  ['F002414', '奶酪'], ['F009176', '豆腐'], ['F002882', '鹰嘴豆'],
  ['F001905', '西兰花'], ['F009193', '番茄'], ['F002276', '胡萝卜'],
  ['F000110', '苹果'], ['F000262', '香蕉'], ['F001290', '蓝莓'],
  ['F006081', '杏仁'], ['F006107', '花生'], ['F006177', '橄榄油'],
  ['F001971', '黄油'], ['F007879', '盐'], ['F008976', '糖'],
  ['F008065', '酱油'], ['F009527', '水'], ['F003017', '咖啡'],
  ['F009125', '茶']
]);
for (const [id, expected] of commonChecks) {
  assert.match(translations[id].name_zh, new RegExp(expected), `${id} common translation`);
  assert.equal(translations[id].translation_status, 'ready');
}

for (const id of ['F007827', 'F005634', 'F000262', 'F001905']) {
  assert.equal(translations[id].translation_source, 'manual_override', `${id} reviewed override source`);
  assert.equal(translations[id].translation_status, 'ready', `${id} reviewed override status`);
}

const manualProbe = {
  F007641: { ...translations.F007641, name_zh: '人工确认测试名称', translation_source: 'manual' }
};
const first = buildTranslationData(source, selection, manualProbe);
const second = buildTranslationData(source, selection, manualProbe);
assert.equal(first.translations.F007641.name_zh, '人工确认测试名称');
assert.equal(first.translations.F007641.translation_source, 'manual');
assert.equal(
  createHash('sha256').update(JSON.stringify(first)).digest('hex'),
  createHash('sha256').update(JSON.stringify(second)).digest('hex'),
  'repeat generation is stable'
);

const statuses = Object.values(translations).reduce((counts, item) => {
  counts[item.translation_status] += 1;
  return counts;
}, { ready: 0, needs_review: 0 });
const englishNames = Object.values(translations).filter((item) => /[A-Za-z]{2,}/.test(item.name_zh));
const aliasCount = Object.values(aliases).reduce((sum, values) => sum + values.length, 0);
console.log(JSON.stringify({
  translations: Object.keys(translations).length,
  fully_chinese: 400 - englishNames.length,
  necessary_english_or_abbreviation: englishNames.length,
  statuses,
  duplicate_name_groups: [...duplicateNames.values()].filter((group) => group.length > 1).length,
  foods_with_aliases: Object.values(aliases).filter((values) => values.length > 0).length,
  aliases: aliasCount
}, null, 2));
console.log('Stage 4 translation verification passed.');
