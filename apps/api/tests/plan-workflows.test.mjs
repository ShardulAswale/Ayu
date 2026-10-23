import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
require('reflect-metadata');
const { Types }=require('mongoose');
const { validateSync }=require('class-validator');
const { PlanWorkflowsController,mondayUTC }=require('../dist/workspace/plan-workflows.controller.js');
const { CreatePlanTemplateDto, PlanTemplateItemDto }=require('../dist/workspace/plan-workflows.dto.js');
const patient='507f1f77bcf86cd799439011';
const clinician='507f1f77bcf86cd799439012';
const templateId='507f1f77bcf86cd799439013';
const oid=x=>new Types.ObjectId(x);
const lookup=x=>({select:()=>({lean:async()=>x})});
function mock(assigned=true,role='dietitian'){
  const inserted=[];
  const queries={
    PatientAssignments:{findOne:async()=>assigned?{patientId:oid(patient)}:null},
    DietPlanTemplates:{findOne:async()=>({
      _id:oid(templateId),createdBy:oid(clinician),
      items:[{title:'Dal and rice',weekday:0,time:'12:00',notes:'Measured serving'},
        {title:'Fruit',weekday:2,time:'15:30'}],
    })},
    DietPlans:{
      find:()=>({sort:()=>({limit:()=>({toArray:async()=>[]})}),
        toArray:async()=>[]}),
      insertMany:async docs=>{inserted.push(...docs);return{};},
      updateMany:async()=>({modifiedCount:0}),
    },
  };
  const users={
    findById:()=>lookup({_id:oid(clinician),role}),
    findOne:()=>lookup({_id:oid(patient),role:'patient',active:true}),
  };
  const controller=new PlanWorkflowsController({
    db:{collection:name=>queries[name]||{}},
  },users);
  return {controller,inserted};
}
const req={session:{userId:clinician}};
test('week inputs require actual Monday dates in UTC',()=>{
  assert.equal(mondayUTC('2026-10-26').toISOString(),'2026-10-26T00:00:00.000Z');
  assert.throws(()=>mondayUTC('2026-10-25'),{name:'BadRequestException'});
  assert.throws(()=>mondayUTC('2026-02-30'),{name:'BadRequestException'});
});
test('malformed template weekday, oversized item and time are rejected',()=>{
  const bad=Object.assign(new PlanTemplateItemDto(),{title:'Breakfast',weekday:7,time:'29:99'});
  assert.ok(validateSync(bad).some(e=>e.property==='weekday'));
  assert.ok(validateSync(bad).some(e=>e.property==='time'));
  const invalid=Object.assign(new CreatePlanTemplateDto(),{name:'',items:[]});
  assert.ok(validateSync(invalid).length>0);
});
test('applying template inserts only draft recommendations at designated times',async()=>{
  const m=mock(true);
  const outcome=await m.controller.apply(req,{patientId:patient,templateId,weekStart:'2026-10-26'});
  assert.equal(outcome.created,2);
  assert.equal(m.inserted.length,2);
  assert.equal(m.inserted[0].status,'draft');
  assert.equal(m.inserted[0].plannedAt.toISOString(),'2026-10-26T12:00:00.000Z');
  assert.equal(m.inserted[1].plannedAt.toISOString(),'2026-10-28T15:30:00.000Z');
  assert.equal(m.inserted[0].notes,'Measured serving');
});
test('unassigned clinician cannot apply template or write drafts',async()=>{
  const m=mock(false);
  await assert.rejects(()=>m.controller.apply(req,{patientId:patient,templateId,weekStart:'2026-10-26'}),
    {name:'ForbiddenException'});
  assert.equal(m.inserted.length,0);
});
test('empty proposed batch yields zero and cannot create accidental records',async()=>{
  const m=mock();
  const result=await m.controller.writeDrafts(req,patient,[]);
  assert.equal(result.created,0);
  assert.equal(m.inserted.length,0);
});
