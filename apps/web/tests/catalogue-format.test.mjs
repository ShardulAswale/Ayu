import test from 'node:test';
import assert from 'node:assert/strict';
import {nutritionLabel} from '../src/catalogue-format.mjs';
test('missing nutrients render as missing rather than zero',()=>{
 assert.equal(nutritionLabel(null,'kcal'),'—');
 assert.equal(nutritionLabel(undefined,'g'),'—');
 assert.equal(nutritionLabel(NaN,'g'),'—');
});
test('real zero is displayed as measured zero',()=>{
 assert.equal(nutritionLabel(0,'g'),'0 g');
});
test('positive values include units',()=>{
 assert.equal(nutritionLabel(52,'kcal'),'52 kcal');
});
