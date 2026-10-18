import test from 'node:test';
import assert from 'node:assert/strict';
import { isFreshSnapshot } from '../src/services/stateFreshness.js';
import { applyCommand, publicState, staffState } from '../server/services/stateEngine.js';
import { elapsedClock } from '../shared/tournament.js';
import { fixture } from './helpers.js';
import { createQueueFlusher } from '../src/services/commandQueue.js';
test('HTTP cũ 0–1 không ghi đè socket mới 5–1; refresh cùng version không lùi mốc thời gian',()=>{
 const newer={schemaVersion:2,_version:12,serverTime:5000,matches:{m:{scoreA:5,scoreB:1}}};
 assert.equal(isFreshSnapshot(newer,{...newer,_version:8,serverTime:6000}),false);
 assert.equal(isFreshSnapshot(newer,{...newer,serverTime:4000}),false);
 assert.equal(isFreshSnapshot(newer,{...newer,_version:13,serverTime:5001}),true);
 assert.equal(isFreshSnapshot({},newer),true);
});
test('6 bàn LIVE cùng tỉ số, tên phân công và đồng hồ ở DTO khán giả/BTC/thư ký; không lộ username/chữ ký',()=>{
 let s=fixture();s.accounts.sec.name='Thư ký sân';s.matches.m.ref='Trọng tài sân';s.matches.m.secretaryNote='private';s.matches.m.signatures={home:'private'};
 const command={id:'clock-sync',kind:'patch',patches:{'matches/m/clock':{elapsed:100,running:true,period:1,startedAt:Date.now(),timeBasis:'server'}},versions:{m:s.matches.m.version}};
 s=applyCommand(s,command,{username:'sec',role:'referee'});
 for(let i=0;i<6;i++)s=applyCommand(s,{kind:'events',id:`goal-${i}`,matchId:'m',baseVersion:s.matches.m.version,add:[{id:`e${i}`,type:'goal',detail:'normal',team:i<5?'A':'B',playerId:i<5?'pa':'pb',minute:i+1,period:1}]},{username:'sec',role:'referee'});
 const pub=publicState(s),btc=staffState(s,{role:'admin'}),sec=staffState(s,{username:'sec',role:'referee'});
 for(const dto of [pub,btc,sec]){assert.equal(dto.matches.m.scoreA,5);assert.equal(dto.matches.m.scoreB,1);assert.equal(elapsedClock(dto.matches.m.clock,s.matches.m.clock.startedAt+23000),123);}
 assert.equal(pub.matches.m.ref,'Trọng tài sân');assert.equal(pub.matches.m.sec,'Thư ký sân');for(const field of ['assignedSecretary','signatures','secretaryNote'])assert.equal(pub.matches.m[field],undefined);
});
test('Mất phản hồi sau khi server đã nhận: retry không nhân đôi bàn, tiếp tục gửi đủ hàng đợi',async()=>{
 let s=fixture(),failed=false;const entries=new Map();
 for(let i=0;i<5;i++)entries.set(`g${i}`,{id:`g${i}`,owner:'sec',createdAt:i,command:{id:`g${i}`,kind:'events',matchId:'m',baseVersion:1,add:[{id:`e${i}`,type:'goal',detail:'normal',team:'A',playerId:'pa',minute:i+1,period:1}]}});
 const flush=createQueueFlusher({entries:async()=>[...entries.values()],owner:()=> 'sec',canSend:()=>true,send:async cmd=>{s=applyCommand(s,cmd,{username:'sec',role:'referee'});if(!failed){failed=true;throw new Error('Timeout');}return s;},accept:()=>{},save:async e=>entries.set(e.id,e),remove:async id=>entries.delete(id),error:()=>{},settled:async()=>{}});
 await flush();assert.equal(entries.size,5);await flush();assert.equal(entries.size,0);assert.equal(s.matches.m.scoreA,5);assert.equal(s.matches.m.events.length,5);
});
