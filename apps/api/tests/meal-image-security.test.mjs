import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('reflect-metadata');
const sharp = require('sharp');
const { ObjectId } = require('mongodb');
const { MealImageService, imageSignature } = require('../dist/workspace/meal-image.service.js');
const { MealImageController } = require('../dist/workspace/meal-image.controller.js');

const owner = '507f1f77bcf86cd799439011';
const other = '507f1f77bcf86cd799439012';
const entryId = '507f1f77bcf86cd799439013';
const clinician = '507f1f77bcf86cd799439014';
const query = value => ({ select:()=>({lean:async()=>value}) });
function controller(role, userId, assigned=false) {
  const entry = {_id:new ObjectId(entryId),patientId:new ObjectId(owner)};
  const connection = { db:{ collection: name=>({
    findOne:async criteria=>{
      if(name==='FoodEntries')return entry;
      if(name==='PatientAssignments')return assigned?{patientId:entry.patientId}:null;
      return null;
    },
  }) } };
  const users = {
    findById:()=>query({_id:new ObjectId(userId),role}),
    findOne:()=>query({_id:new ObjectId(owner),role:'patient',active:true}),
  };
  return new MealImageController(connection,users,{});
}
test('JPEG PNG WebP signatures are accepted; SVG and random bytes are denied',()=>{
  assert.equal(imageSignature(Buffer.from([255,216,255,0])),'jpeg');
  assert.equal(imageSignature(Buffer.from([137,80,78,71,13,10,26,10])),'png');
  assert.equal(imageSignature(Buffer.from('RIFFxxxxWEBP')),'webp');
  assert.equal(imageSignature(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),null);
});
test('image pipeline reencodes to bounded WebP and removes embedded metadata',async()=>{
  const service=new MealImageService({});
  const input=await sharp({create:{width:1400,height:950,channels:3,background:'#ffcc00'}})
    .jpeg().withMetadata({orientation:1}).toBuffer();
  const output=await service.sanitise(input);
  const meta=await sharp(output).metadata();
  assert.equal(meta.format,'webp');
  assert.ok(meta.width<=1024&&meta.height<=1024);
  assert.equal(meta.exif,undefined);
});
test('malformed images and oversize payloads fail closed',async()=>{
  const service=new MealImageService({});
  await assert.rejects(()=>service.sanitise(Buffer.from('<svg/>')),{name:'BadRequestException'});
  await assert.rejects(()=>service.sanitise(Buffer.alloc(5*1024*1024+1,255)),{name:'BadRequestException'});
  await assert.rejects(()=>service.sanitise(Buffer.from([255,216,255])),{name:'BadRequestException'});
});
test('patient image access is restricted to the entry owner',async()=>{
  await assert.rejects(()=>controller('patient',other).authorised({session:{userId:other}},entryId),
    {name:'ForbiddenException'});
  const own=await controller('patient',owner).authorised({session:{userId:owner}},entryId);
  assert.equal(String(own.patientId),owner);
});
test('unassigned clinician cannot view patient image',async()=>{
  await assert.rejects(()=>controller('dietitian',clinician,false).authorised({session:{userId:clinician}},entryId),
    {name:'ForbiddenException'});
  const allowed=await controller('dietitian',clinician,true).authorised({session:{userId:clinician}},entryId);
  assert.equal(String(allowed.patientId),owner);
});
test('local vision never sends an image externally when unconfigured',async()=>{
  const prior=process.env.AYU_LOCAL_VISION_URL;
  delete process.env.AYU_LOCAL_VISION_URL;
  try{
    await assert.rejects(()=>new MealImageService({}).recognise(Buffer.from('sample')),{name:'NotImplementedException'});
  } finally{
    if(prior===undefined)delete process.env.AYU_LOCAL_VISION_URL;
    else process.env.AYU_LOCAL_VISION_URL=prior;
  }
});

test('concurrent upload conflict removes the unreferenced new GridFS image',async()=>{
  const removed=[];
  const entry={_id:new ObjectId(entryId),patientId:new ObjectId(owner)};
  const connection={db:{collection:name=>({
    findOne:async()=>name==='FoodEntries'?entry:null,
    updateOne:async()=>({matchedCount:0}),
  })}};
  const users={
    findById:()=>query({_id:new ObjectId(owner),role:'patient'}),
    findOne:()=>query({_id:new ObjectId(owner),role:'patient',active:true}),
  };
  const imageId=new ObjectId();
  const imageService={
    sanitise:async()=>Buffer.from('safe'),
    save:async()=>imageId,
    remove:async id=>removed.push(String(id)),
  };
  const c=new MealImageController(connection,users,imageService);
  await assert.rejects(()=>c.upload({session:{userId:owner}},entryId,{
    buffer:Buffer.from([255,216,255]),size:3,mimetype:'image/jpeg',
  }),{name:'ConflictException'});
  assert.deepEqual(removed,[String(imageId)]);
});
