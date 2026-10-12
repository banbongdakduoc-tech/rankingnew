import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import { Database } from '../server/config/db.js';
import { createApp } from '../server/app.js';
import { deleteSecondaryAccount } from '../server/services/accounts.js';
import { initialState, staffState, validateBackup, exportBackup } from '../server/services/stateEngine.js';
import { generateToken, authenticate } from '../server/middleware/auth.js';
import { fixture } from './helpers.js';
const admin={username:'admin',role:'admin'};

test('Xóa tài khoản phụ thu hồi token, xóa hash, giữ lịch sử, bỏ phân công trận chưa bắt đầu',()=>{
  const s=fixture();s.accounts.review={name:'Reviewer',role:'approver',passwordHash:'private'};
  s.accounts.sec.passwordHash='private';s.matches.m.status='Sắp diễn ra';
  s.matches.finished={...structuredClone(s.matches.m),id:'finished',status:'Đã xong',scoreA:0,scoreB:0,signatureException:'Test history'};
  const beforeVersion=s.matches.m.version;
  deleteSecondaryAccount(s,'sec','sec',admin);
  assert.equal(s.accounts.sec.disabled,true);assert.equal(s.accounts.sec.passwordHash,undefined);
  assert.equal(s.accounts.sec.sessionVersion,1);assert.ok(s.accounts.sec.deletedAt);
  assert.equal(s.matches.m.assignedSecretary,'');assert.equal(s.matches.m.version,beforeVersion+1);
  assert.equal(s.matches.finished.assignedSecretary,'sec');
  assert.equal(staffState(s,admin).secretaryAccounts.length,1); // other, not deleted sec
  assert.equal(staffState(s,admin).secretaryAccounts.some(a=>a.username==='sec'),false);
  assert.doesNotThrow(()=>validateBackup(exportBackup(s),s.accounts));
  const after=structuredClone(s);deleteSecondaryAccount(s,'sec','sec',admin);assert.deepEqual(s,after);
  assert.equal(s.audit.at(-1).kind,'delete_account');assert.ok(!JSON.stringify(s.audit).includes('private'));
  deleteSecondaryAccount(s,'review','review',admin);assert.equal(staffState(s,admin).reviewAccounts.length,0);
});
test('Không xóa admin, bản thân, xác nhận sai; không xóa thư ký có biên bản chưa hoàn tất',()=>{
  for(const status of ['Đang LIVE','Chờ duyệt','Bị từ chối']){
    const s=fixture();s.matches.m.status=status;const before=structuredClone(s);
    assert.throws(()=>deleteSecondaryAccount(s,'sec','sec',admin),e=>e.status===409);assert.deepEqual(s,before);
  }
  const s=fixture();s.accounts.boss={role:'admin'};
  assert.throws(()=>deleteSecondaryAccount(s,'admin','admin',admin),e=>e.status===403);
  assert.throws(()=>deleteSecondaryAccount(s,'boss','boss',admin),e=>e.status===403);
  assert.throws(()=>deleteSecondaryAccount(s,'other','wrong',admin),e=>e.status===422);
  assert.throws(()=>deleteSecondaryAccount(s,'missing','missing',admin),e=>e.status===404);
  assert.throws(()=>deleteSecondaryAccount(s,'other','other',{username:'review',role:'approver'}),e=>e.status===403);
});
test('HTTP xóa tài khoản chỉ admin chính; JWT cũ mất quyền, login cũ và tái sử dụng username bị chặn',async t=>{
  const s=initialState();s.accounts={admin:{role:'admin'},sec:{role:'referee',name:'Secretary',passwordHash:await bcrypt.hash('test-delete-password',4)},review:{role:'approver'}};
  const db=await new Database({mode:'memory',data:s}).init();let broadcasts=0;
  const server=createApp(db,{broadcast:()=>broadcasts++}).listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function call(path,{method='GET',token,body}={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
  const adminToken=generateToken(admin),staffToken=generateToken({username:'sec',role:'referee'}),reviewToken=generateToken({username:'review',role:'approver'});
  const remove=token=>call('/api/auth/accounts/sec',{method:'DELETE',token,body:{confirmation:'sec'}});
  assert.equal((await remove()).status,401);assert.equal((await remove(reviewToken)).status,403);assert.equal((await remove(staffToken)).status,403);
  assert.equal((await call('/api/auth/accounts/sec',{method:'DELETE',token:adminToken,body:{confirmation:'bad'}})).status,422);
  assert.equal((await remove(adminToken)).status,200);assert.equal(broadcasts,1);
  assert.throws(()=>authenticate(staffToken,db));
  assert.equal((await call('/api/auth/me',{token:staffToken})).status,401);
  assert.equal((await call('/api/auth/login',{method:'POST',body:{username:'sec',password:'test-delete-password'}})).status,401);
  assert.equal((await call('/api/auth/accounts',{method:'POST',token:adminToken,body:{username:'sec',name:'Reused',password:'test-new-password'}})).status,409);
  const dto=(await call('/api/tournament/data',{token:adminToken})).data.data;
  assert.equal(dto.secretaryAccounts.length,0);assert.equal(JSON.stringify(dto).includes('passwordHash'),false);
});
