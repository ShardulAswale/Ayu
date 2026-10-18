import test from 'node:test';
import assert from 'node:assert/strict';
import { singleFlight } from '../src/single-flight.mjs';

test('concurrent session checks make one backend request', async () => {
  let count = 0;
  const check = singleFlight(async () => { count++; return {role:'patient'}; });
  const [a,b] = await Promise.all([check(),check()]);
  assert.equal(count,1);
  assert.equal(a,b);
});

test('a completed check does not indefinitely cache user identity', async () => {
  let count=0;
  const check=singleFlight(async () => ++count);
  assert.equal(await check(),1);
  assert.equal(await check(),2);
});

test('a failing check can be retried', async () => {
  let count=0;
  const check=singleFlight(async () => {if(++count===1)throw Error('offline');return true;});
  await assert.rejects(()=>check(),/offline/);
  assert.equal(await check(),true);
});

test('reset after login prevents an old anonymous request being reused',async()=>{
  let resolveOld;
  let calls=0;
  const check=singleFlight(()=> {
    ++calls;
    return calls===1 ? new Promise(resolve=>{resolveOld=resolve}) : Promise.resolve({role:'admin'});
  });
  const old=check();
  await Promise.resolve();
  check.reset();
  const fresh=check();
  resolveOld(null);
  assert.equal(await old,null);
  assert.deepEqual(await fresh,{role:'admin'});
  assert.equal(calls,2);
  assert.deepEqual(await check(),{role:'admin'});
});
