import test from 'node:test';
import assert from 'node:assert/strict';
import { firebaseTarget } from '../server/config/firebaseTarget.js';

const config={FIREBASE_DATABASE_URL:'https://main.example',FIREBASE_SERVICE_ACCOUNT_JSON:'{}',DPL_DATABASE_PATH:'environments/demo2026'};
test('Firebase demo mặc định vẫn chặn root và namespace main',()=>{
  assert.equal(firebaseTarget(config),'environments/demo2026');
  for(const p of ['/','environments/production','environments/main'])assert.throws(()=>firebaseTarget({...config,DPL_DATABASE_PATH:p}));
});
test('Firebase main cần chọn production và xác nhận đúng database',()=>{
  const prod={...config,DPL_DEPLOYMENT_ENV:'production',DPL_DATABASE_PATH:'/'};
  assert.throws(()=>firebaseTarget(prod));
  assert.throws(()=>firebaseTarget({...prod,DPL_PRODUCTION_DATABASE_URL:'https://wrong.example'}));
  assert.equal(firebaseTarget({...prod,DPL_PRODUCTION_DATABASE_URL:config.FIREBASE_DATABASE_URL}),'/');
  assert.equal(firebaseTarget({...prod,DPL_PRODUCTION_DATABASE_URL:config.FIREBASE_DATABASE_URL,DPL_DATABASE_PATH:'environments/production2026'}),'environments/production2026');
  assert.throws(()=>firebaseTarget({...prod,DPL_PRODUCTION_DATABASE_URL:config.FIREBASE_DATABASE_URL,DPL_DATABASE_PATH:'environments/demo2026'}));
  assert.throws(()=>firebaseTarget({...config,DPL_DEPLOYMENT_ENV:'typo'}));
  assert.throws(()=>firebaseTarget({...config,FIREBASE_SERVICE_ACCOUNT_JSON:''}));
});
