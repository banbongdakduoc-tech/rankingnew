import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import { createApp } from '../server/app.js';
import { Database } from '../server/config/db.js';
import { fixture } from './helpers.js';
import { generateToken } from '../server/middleware/auth.js';

test('API thực: auth, public DTO, quyền, validation, đồng thời, backup và thu hồi phiên',async t=>{
  const data=fixture();data.accounts.admin.passwordHash=await bcrypt.hash('test-only-password',4);
  const db=new Database({mode:'memory',data});await db.init();const app=createApp(db),server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}`;
  async function call(path,body,token){const res=await fetch(url+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};}
  const admin=generateToken({username:'admin',role:'admin'}),staff=generateToken({username:'sec',role:'referee'});
  await t.test('Public không đọc account hoặc staff fields',async()=>{const result=await call('/api/tournament/data');assert.equal(result.status,200);assert.equal(result.data.data.accounts,undefined);assert.equal(result.data.data.matches.m.assignedSecretary,undefined);});
  await t.test('Login đúng và sai trả status rõ',async()=>{assert.equal((await call('/api/auth/login',{username:'admin',password:'wrong'})).status,401);const login=await call('/api/auth/login',{username:'admin',password:'test-only-password'});assert.equal(login.status,200);assert.ok(login.data.token);assert.equal(login.data.user.passwordHash,undefined);});
  await t.test('Không token không ghi được; endpoint cũ không bypass',async()=>{assert.equal((await call('/api/state/commands',{kind:'patch'})).status,401);assert.equal((await call('/api/matches/m/approve',{},staff)).status,404);});
  const event=id=>({id,team:'A',player:'10 - P',playerId:'pa',type:'goal',detail:'normal',minute:10,period:1});
  await t.test('20 request đồng thời giữ đủ event, replay không trùng',async()=>{const commands=Array.from({length:20},(_,i)=>({id:`c${i}`,kind:'events',matchId:'m',baseVersion:1,add:[event(`e${i}`)]}));const results=await Promise.all(commands.map(c=>call('/api/state/commands',c,staff)));assert.ok(results.every(r=>r.status===200));await call('/api/state/commands',commands[0],staff);assert.equal(db.get('matches').m.events.length,20);assert.equal(db.get('matches').m.scoreA,20);});
  await t.test('Event sai bị chặn và dữ liệu không đổi',async()=>{const before=db.getAll();const result=await call('/api/state/commands',{id:'invalid',kind:'events',matchId:'m',baseVersion:1,add:[{...event('bad'),team:'C'}]},staff);assert.equal(result.status,422);assert.deepEqual(db.getAll(),before);});
  await t.test('Backup BTC riêng, không tài khoản; staff bị chặn',async()=>{assert.equal((await call('/api/backup/export',null,staff)).status,403);const r=await call('/api/backup/export',null,admin);assert.equal(r.status,200);assert.equal(r.data.schemaVersion,2);assert.equal(r.data.accounts,undefined);});
  await t.test('Chỉ admin tạo thư ký: bcrypt, trùng tên, đồng thời và không lộ mật khẩu',async()=>{
    const body={username:'new_sec',name:'Thư ký mới',password:'test-new-secretary-password',role:'admin'};
    assert.equal((await call('/api/auth/accounts',body)).status,401);
    assert.equal((await call('/api/auth/accounts',body,staff)).status,403);
    assert.equal((await call('/api/auth/accounts',{...body,password:'short'},admin)).status,422);
    assert.equal((await call('/api/auth/accounts',{...body,username:'__proto__'},admin)).status,422);
    const results=await Promise.all([call('/api/auth/accounts',body,admin),call('/api/auth/accounts',body,admin)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
    const account=db.get('accounts').new_sec;assert.equal(account.role,'referee');assert.equal(account.password,undefined);assert.ok(await bcrypt.compare(body.password,account.passwordHash));
    const login=await call('/api/auth/login',{username:'new_sec',password:body.password});assert.equal(login.status,200);assert.equal(login.data.user.role,'referee');
    const publicData=(await call('/api/tournament/data')).data.data;assert.equal(publicData.secretaryAccounts,undefined);
    const adminData=(await call('/api/tournament/data',null,admin)).data.data;assert.ok(adminData.secretaryAccounts.some(a=>a.username==='new_sec'));assert.ok(!JSON.stringify(adminData).includes(account.passwordHash));
    assert.ok(!JSON.stringify(db.get('audit')).includes(body.password));
  });
  await t.test('Thu hồi account làm token cũ vô hiệu',async()=>{await db.mutate(state=>{state.accounts.sec.disabled=true;return state;});assert.equal((await call('/api/tournament/data',null,staff)).status,401);});
  await t.test('Hồ sơ mùa đã reset truy cập công khai có allowlist, ID sai trả 404',async()=>{const state=db.getAll();const reset=await call('/api/state/commands',{id:'reset-season',kind:'reset',expectedVersion:state._version,confirmation:state.tourConfig.name},admin);assert.equal(reset.status,200);const id=Object.keys(db.get('seasons'))[0],result=await call(`/api/seasons/${id}`);assert.equal(result.status,200);assert.equal(result.data.data.accounts,undefined);assert.equal(result.data.data.matches.m.signatures,undefined);assert.equal((await call('/api/seasons/missing')).status,404);});

});
