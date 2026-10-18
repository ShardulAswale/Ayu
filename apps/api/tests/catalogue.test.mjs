import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {Types}=require('mongoose');
const {foodForWorkspace,recipeForWorkspace,nutritionValues,escapedSearch}=require('../dist/workspace/catalogue.mapper.js');
const {WorkspaceController}=require('../dist/workspace/workspace.controller.js');
const id=s=>new Types.ObjectId(s.padStart(24,'0'));

test('nested nutrition maps to flat display fields; missing nutrients remain null',()=>{
 const x=recipeForWorkspace({_id:id('1'),name:'Oats',nutritionPerServing:{caloriesKcal:430,proteinG:23,carbsG:58,fatG:12,fiberG:9}});
 assert.equal(x.calories,430);assert.equal(x.protein,23);assert.equal(x.fiber,9);
 assert.equal(nutritionValues({}).calories,null);
});
test('flat legacy recipes retain their values',()=>{
 const x=recipeForWorkspace({_id:id('1'),name:'Legacy',calories:100,protein:5});
 assert.equal(x.calories,100);assert.equal(x.protein,5);assert.equal(x.fat,null);
});
test('food resolves ObjectId tag refs without sending embedded source variants',()=>{
 const x=foodForWorkspace({_id:id('1'),name:'Apple',categoryId:id('2'),tagIds:[id('3')],
 nutritionPer100g:{energyKcal:52},source:{canonicalFdcId:123,variants:[{large:'data'}]}},
 new Map([[String(id('2')),{label:'Fruits'}],[String(id('3')),{slug:'high-fiber'}]]));
 assert.equal(x.category.label,'Fruits');assert.equal(x.tags[0].slug,'high-fiber');
 assert.equal(x.nutrients.calories,52);assert.equal(x.nutrients.fiber,null);
 assert.equal(x.source.variants,undefined);
});
test('special search characters are interpreted literally',()=>{
 assert.equal(escapedSearch('apple.*[a]'),'apple\\.\\*\\[a\\]');
});
test('food catalogue endpoint is paginated with batched tag lookups',async()=>{
 const food={_id:id('1'),name:'Apple',categoryId:id('2'),tagIds:[id('3')],nutritionPer100g:{caloriesKcal:52}};
 const used={};
 const connection={db:{collection(name){
  if(name==='Foods')return {find(filter,opts){used.filter=filter;used.projection=opts.projection;
   return {sort(){return this},skip(n){used.skip=n;return this},limit(n){used.limit=n;return this},toArray:async()=>[food]};},
   countDocuments:async()=>13522};
  if(name==='Tags')return {find(filter){used.tags=filter;return {toArray:async()=>[
   {_id:id('2'),label:'Fruits'},{_id:id('3'),label:'High fibre'}]};}};
  throw Error('unexpected '+name);
 }}};
 const c=new WorkspaceController(connection,{});
 const result=await c.foods('Apple','2','25');
 assert.equal(result.total,13522);assert.equal(result.page,2);
 assert.equal(result.items[0].category.label,'Fruits');
 assert.equal(used.skip,25);assert.equal(used.limit,25);
 assert.equal(used.tags._id.$in.length,2);
 assert.equal(used.projection['source.variants'],undefined);
});
test('invalid search pagination and lengthy queries are rejected',async()=>{
 const c=new WorkspaceController({db:{}},{});
 await assert.rejects(()=>c.foods('apple','0','25'),{name:'BadRequestException'});
 await assert.rejects(()=>c.foods('apple','1','101'),{name:'BadRequestException'});
 await assert.rejects(()=>c.foods('a'.repeat(101)),{name:'BadRequestException'});
});
