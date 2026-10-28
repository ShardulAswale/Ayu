/**
 * Manual, idempotent index setup for meal photographs and diet plan workflows.
 * Run only with reviewed credentials against the intended Ayu database.
 */
import mongoose from 'mongoose';
const uri=process.env.MONGODB_URI;
if(!uri || !/^mongodb(\+srv)?:\/\//.test(uri) || !/\/Ayu(?:\?|$)/.test(uri)) {
  throw new Error('Set MONGODB_URI explicitly pointing to /Ayu');
}
await mongoose.connect(uri,{serverSelectionTimeoutMS:8000});
try{
  const db=mongoose.connection.db;
  if(!db || db.databaseName!=='Ayu')throw new Error('Refusing an unknown database');
  await db.collection('FoodEntries').createIndex({patientId:1,eatenAt:-1});
  await db.collection('DietPlans').createIndex({patientId:1,plannedAt:1,status:1});
  await db.collection('DietPlanTemplates').createIndex({createdBy:1,createdAt:-1});
  await db.collection('DietPlanRevisions').createIndex({planId:1,createdAt:-1});
  await db.collection('PrivateMealImages.files').createIndex({'metadata.patientId':1,'metadata.entryId':1});
  console.log('Ayu meal-image and diet-plan indexes verified');
}finally{
  await mongoose.disconnect();
}
