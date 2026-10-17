import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRecipeIngredients, displayText } from '../src/recipe-format.mjs';

test('renders existing text ingredients without modification', () => {
  assert.equal(formatRecipeIngredients('Rice 100g, lentils 50g'), 'Rice 100g, lentils 50g');
});

test('renders imported recipe ingredients as text rather than object children', () => {
  const imported = [{ name: 'Rice', quantity: 100, unit: 'g' }, { name: 'Lentils', quantity: 50, unit: 'g' }];
  const original = structuredClone(imported);
  assert.equal(formatRecipeIngredients(imported), 'Rice (100 g), Lentils (50 g)');
  assert.deepEqual(imported, original, 'formatting must not modify MongoDB values');
});

test('supports one imported ingredient object', () => {
  assert.equal(formatRecipeIngredients({ name: 'Milk', quantity: 1, unit: 'cup' }), 'Milk (1 cup)');
});

test('supports missing ingredient quantities and mixed arrays', () => {
  assert.equal(formatRecipeIngredients(['Salt', { name: 'Cumin', unit: 'tsp' }, { name: 'Oil', quantity: 2 }]), 'Salt, Cumin (tsp), Oil (2)');
});

test('never renders unknown objects directly and handles missing data', () => {
  assert.equal(formatRecipeIngredients([{ irrelevant: 'value' }]), 'Ingredient details unavailable');
  assert.equal(formatRecipeIngredients([]), 'Ingredients not specified');
  assert.equal(formatRecipeIngredients(null), 'Ingredients not specified');
  assert.equal(displayText([{name:'Peanut'}, 'Sesame']), 'Peanut, Sesame');
  assert.equal(displayText(null), '');
});

test('formatted text can safely support search and recipe edit input', () => {
  const value = formatRecipeIngredients([{ name: 'Quinoa', quantity: 75, unit: 'g' }]);
  assert.equal(value.toLowerCase().includes('quinoa'), true);
  assert.equal(typeof value, 'string');
});
