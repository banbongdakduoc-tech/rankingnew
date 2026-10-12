import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { initialState, applyCommand, staffState, publicState, reportHash } from '../server/services/stateEngine.js';
import { Database } from '../server/config/db.js';
import { createApp } from '../server/app.js';
import { generateToken } from '../server/middleware/auth.js';
import { fixture } from './helpers.js';
const admin={username:'admin',role:'admin'},reviewer={username:'review',role:'approver'};
const signature='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const cmd=(s,patches)=>({id:crypto.randomUUID(),kind:'patch',patches,expectedVersion:s._version,versions:{m:s.matches.m.version}});
function pending(){const s=fixture();s.accounts.review={role:'approver'};s.matches.m.status='Chờ duyệt';s.matches.m.secretaryNote='Ghi chú đối chiếu';s.matches.m.signatures={home:signature,away:signature,referee:signature};s.matches.m.signatureHash=reportHash(s.matches.m);return s;}
for(const count of [1,2,4])test(`Tạo ${count} bảng nguyên tử, round-trip Firebase bỏ teams rỗng vẫn thêm đội được`,()=>{
 const s=initialState({tourStatus:'config'}),groups=Array.from({length:count},(_,i)=>({groupName:`Bảng ${'ABCD'[i]}`,teams:[]}));
 const next=applyCommand(s,{id:crypto.randomUUID(),kind:'patch',expectedVersion:s._version,patches:{tourConfig:{...s.tourConfig,numGroups:count,knockoutFormat:'semi'},groupsData:groups,tourStatus:'setup_teams'}},admin);
 assert.equal(next.tourStatus,'setup_teams');assert.equal(next.groupsData.length,count);
 const firebase=structuredClone(next);for(const g of firebase.groupsData)delete g.teams;
 const after=applyCommand(firebase,{id:crypto.randomUUID(),kind:'patch',expectedVersion:firebase._version,patches:{'groupsData/0/teams':['Đội 1','Đội 2']}},admin);
 assert.deepEqual(after.groupsData[0].teams,['Đội 1','Đội 2']);assert.ok(after.groupsData.every(g=>Array.isArray(g.teams)));
});
test('Cấu hình lỗi không cập nhật một phần; league cho bảng trống; trùng bảng vẫn bị chặn',()=>{
 const s=initialState({tourStatus:'config'}),command={id:'setup',kind:'patch',expectedVersion:0,patches:{tourConfig:{...s.tourConfig,numGroups:3},groupsData:[{groupName:'Bảng A'}],tourStatus:'setup_teams'}};
 assert.throws(()=>applyCommand(s,command,admin));assert.equal(s.tourStatus,'config');assert.deepEqual(s.groupsData,[]);
 const next=applyCommand(s,{...command,patches:{tourConfig:{...s.tourConfig,format:'league'},groupsData:[{groupName:'Bảng Tổng (League)',teams:[]}],tourStatus:'setup_teams'}},admin);assert.equal(next.groupsData.length,1);
 assert.throws(()=>applyCommand(s,{...command,patches:{groupsData:[{groupName:'Bảng A',teams:[]},{groupName:'Bảng A',teams:[]}]}},admin),/trùng/);
});
test('Admin phụ duyệt/trả biên bản; không cần ghi chú khi nguyên trạng; retry idempotent',()=>{
 const s=pending(),command=cmd(s,{'matches/m/status':'Đã xong'});const next=applyCommand(s,command,reviewer);assert.equal(next.matches.m.approvedBy,'review');assert.deepEqual(applyCommand(next,command,reviewer),next);
 assert.equal(applyCommand(s,cmd(s,{'matches/m/status':'Bị từ chối','matches/m/rejectReason':'Kiểm tra lại phút'}),reviewer).matches.m.status,'Bị từ chối');
 const card={id:'card',type:'card',detail:'yellow',team:'A',playerId:'pa',player:'10 - P',minute:5,period:1};
 assert.throws(()=>applyCommand(s,cmd(s,{'matches/m/status':'Đã xong','matches/m/events':[card]}),reviewer),/sau khi ký/);
 assert.equal(applyCommand(s,cmd(s,{'matches/m/status':'Đã xong','matches/m/events':[card],'matches/m/signatureException':'Đối chiếu thẻ thiếu'}),reviewer).matches.m.status,'Đã xong');
});
test('Admin phụ không nâng quyền, sửa lịch/đội hình, reset, restore, mở lại hay tác nghiệp LIVE',()=>{
 const s=pending();
 for(const patches of [{'tourStatus':'none'},{'tourConfig/name':'Fake'},{'players/A':[]},{'suspensions/A@@pa':{}},{'matches/new':s.matches.m},{'matches/m/date':'2026-10-15T08:00Z'},{'matches/m/assignedSecretary':'review'},{'matches/m/lineupA':[]},{'matches/m/signatures':{}},{'matches/m':s.matches.m},{'matches/m/status':'Đang LIVE'}])assert.throws(()=>applyCommand(s,cmd(s,patches),reviewer),e=>e.status===403);
 for(const kind of ['reset','restore','reopen','events'])assert.throws(()=>applyCommand(s,{...cmd(s,{}),kind},reviewer),e=>e.status===403);
 const live=fixture();assert.throws(()=>applyCommand(live,cmd(live,{'matches/m/status':'Đã xong'}),reviewer),e=>e.status===403);
 const dto=staffState(s,reviewer);assert.equal(dto.matches.m.secretaryNote,'Ghi chú đối chiếu');assert.ok(dto.matches.m.signatures);assert.equal(dto.secretaryAccounts,undefined);assert.equal(dto.reviewAccounts,undefined);assert.equal(dto.accounts,undefined);assert.equal(publicState(s).matches.m.signatures,undefined);
});
test('API: admin tạo admin phụ, login /btc, duyệt được nhưng không tạo tài khoản hoặc xuất backup',async t=>{
 const db=new Database({mode:'memory',data:pending()});const app=createApp(db),server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}`,token=generateToken(admin);
 const call=async(path,body,auth)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
 const body={username:'review_new',name:'Admin phụ test',password:'test-reviewer-password',role:'approver'};
 assert.equal((await call('/api/auth/accounts',body,token)).status,201);
 const login=await call('/api/auth/login',{username:body.username,password:body.password});assert.equal(login.status,200);assert.equal(login.data.user.role,'approver');
 const reviewToken=login.data.token;assert.equal((await call('/api/auth/accounts',{...body,username:'unauthorized'},reviewToken)).status,403);assert.equal((await call('/api/backup/export',null,reviewToken)).status,403);
 assert.equal((await call('/api/state/commands',cmd(db.getAll(),{'matches/m/status':'Đã xong'}),reviewToken)).status,200);
 assert.equal((await call('/api/tournament/data',null,token)).data.data.reviewAccounts.some(a=>a.username===body.username),true);
 assert.equal(JSON.stringify(db.get('audit')).includes(body.password),false);
});
