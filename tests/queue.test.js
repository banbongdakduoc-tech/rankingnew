import test from 'node:test';
import assert from 'node:assert/strict';
import { createQueueFlusher } from '../src/services/commandQueue.js';
import { shootoutSummary, shootoutUsedPlayers, shootoutRows, shootoutRestrictions, validateShootoutDraft } from '../shared/tournament.js';
function queue(send) {
 const store=new Map(),sent=[],errors=[];let connected=true;
 const add=id=>store.set(id,{id,owner:'sec',createdAt:store.size,command:{id}});
 const flush=createQueueFlusher({entries:async()=>[...store.values()],owner:()=> 'sec',canSend:()=>connected,send:async c=>{sent.push(c.id);return send(c);},accept:()=>{},save:async e=>store.set(e.id,e),remove:async id=>store.delete(id),error:e=>{errors.push(e);if(!e.status)connected=false;},settled:async()=>{}});
 return {store,sent,errors,add,flush,reconnect:()=>connected=true};
}
test('Queue drains commands added mid-flight; concurrent callers await same flush',async()=>{
 let unblock,started;const ready=new Promise(r=>started=r),gate=new Promise(r=>unblock=r);
 const q=queue(async c=>{if(c.id==='one'){started();await gate;}return {};});
 q.add('one');const first=q.flush();await ready;q.add('two');const second=q.flush();assert.equal(first,second);unblock();await second;assert.deepEqual(q.sent,['one','two']);assert.equal(q.store.size,0);
});
test('422 deleted from local queue; later valid correction sends and is not blocked',async()=>{
 const q=queue(async c=>{if(c.id==='invalid')throw Object.assign(new Error('Người sút trùng'),{status:422});return {};});
 q.add('invalid');q.add('corrected');await q.flush();assert.equal(q.store.has('invalid'),false);assert.equal(q.store.has('corrected'),false);await q.flush();assert.deepEqual(q.sent,['invalid','corrected']);
});
test('409 remains a conflict; offline command stays queued and retries without losing draft',async()=>{
 let online=false;const q=queue(async c=>{if(c.id==='conflict')throw Object.assign(new Error('Đổi trên thiết bị khác'),{status:409});if(!online)throw new Error('Network');return {};});
 q.add('conflict');q.add('offline');await q.flush();assert.equal(q.store.get('conflict').conflict,'Đổi trên thiết bị khác');assert.equal(q.store.get('offline').rejected,undefined);online=true;q.reconnect();await q.flush();assert.equal(q.store.has('offline'),false);assert.equal(q.store.has('conflict'),true);
});
test('4–1 kicks override stale 2–1 summary and printed score; cancellation recalculates',()=>{
 const kicks=[['A','scored'],['B','scored'],['A','scored'],['B','missed'],['A','scored'],['B','missed'],['A','scored']].map(([team,result],i)=>({team,result,playerId:`p${i}`}));
 const match={home:'A',away:'B',penA:2,penB:1,shootout:kicks};assert.equal(shootoutSummary(match).penA,4);assert.equal(shootoutSummary(match).penB,1);assert.equal(shootoutSummary(match).winner,'A');assert.equal(shootoutSummary({...match,shootout:kicks.slice(0,-1)}).penA,3);
 assert.deepEqual(shootoutSummary({penA:4,penB:3}),{penA:4,penB:3,winner:''});
});
test('Player cannot shoot again until eligible roster completes cycle; cancelled/retake ignored',()=>{
 const kicks=[{team:'A',playerId:'a'},{team:'B',playerId:'x'},{team:'A',playerId:'b',cancelled:true},{team:'A',playerId:'b',result:'retake'}];
 assert.deepEqual([...shootoutUsedPlayers(kicks,'A',['a','b'])],['a']);
 assert.equal(shootoutUsedPlayers([...kicks,{team:'A',playerId:'b'}],'A',['a','b']).size,0);
 assert.deepEqual([...shootoutUsedPlayers([...kicks,{team:'A',playerId:'b'},{team:'A',playerId:'a'}],'A',['a','b'])],['a']);
});

test('Luân lưu theo đội: lượt từng đội độc lập, khách sút trước, hủy lượt và đột tử',()=>{
 const match={home:'A',away:'B',shootout:[{team:'B',player:'B1',result:'scored'},{team:'A',player:'A1',result:'scored'},{team:'B',player:'B2',cancelled:true},{team:'B',player:'B3',result:'missed'}]};
 const rows=shootoutRows(match,3);assert.equal(rows.length,3);assert.equal(rows[0].home.player,'A1');assert.equal(rows[0].away.player,'B1');assert.equal(rows[1].home,null);assert.equal(rows[1].away.player,'B3');assert.equal(rows[2].attempt,3);
 const sudden=shootoutRows({home:'A',away:'B',shootout:Array.from({length:6},(_,i)=>({team:'A',player:`P${i}`,result:'scored'}))},5);assert.equal(sudden[5].attempt,6);
});

const roster={A:[{id:'a',num:1,name:'A1'},{id:'b',num:2,name:'A2'}],B:[{id:'x',num:1,name:'B1'},{id:'y',num:2,name:'B2'}]};
const ko={id:'ko',home:'A',away:'B',group:'Vòng Knock-out',scoreA:1,scoreB:1,events:[]};
const card=(playerId,detail,phase='play',sequence=1)=>({id:playerId+detail+sequence,type:'card',team:'A',playerId,detail,phase,minute:10,period:1,sequence});
test('Luân lưu: đỏ trực tiếp, hai vàng, thẻ bị hủy, tách vàng trận/luân lưu',()=>{
 assert.equal(shootoutRestrictions({...ko,events:[card('a','red')]},roster).get('A@@a'),'Thẻ đỏ trực tiếp');
 assert.equal(shootoutRestrictions({...ko,events:[card('a','yellow'),card('a','second_yellow_red','play',2)]},roster).get('A@@a'),'Thẻ vàng thứ hai');
 assert.equal(shootoutRestrictions({...ko,events:[card('a','yellow'),card('a','yellow','play',2)]},roster).get('A@@a'),'Thẻ vàng thứ hai');
 assert.equal(shootoutRestrictions({...ko,events:[{...card('a','red'),cancelled:true}]},roster).size,0);
 assert.equal(shootoutRestrictions({...ko,events:[card('a','yellow'),card('a','yellow','shootout',2)]},roster).size,0);
});
test('Preflight rejects invalid turn, duplicate player and dismissal before calling save',async()=>{
 let calls=0;const record=async(match,kicks)=>{validateShootoutDraft(match,kicks,roster);calls++;};
 const kick=(id,team,playerId)=>({id,team,playerId,result:'scored',sequence:2});
 await assert.rejects(record(ko,[kick('1','A','a'),kick('2','A','b')]),/luân phiên/);
 await assert.rejects(record(ko,[kick('1','A','a'),kick('2','B','x'),kick('3','A','a')]),/phải sút/);
 await assert.rejects(record({...ko,events:[card('a','red')]},[kick('1','A','a')]),/Thẻ đỏ/);
 await assert.rejects(record({...ko,events:[card('a','yellow'),card('a','second_yellow_red','play',2)]},[kick('1','A','a')]),/vàng thứ hai/);
 assert.equal(calls,0);await record(ko,[kick('1','A','a')]);assert.equal(calls,1);
});
test('Red during shootout retains earlier valid kick; prevents future kick and recalculates eligible cycle',()=>{
 const match={...ko,events:[card('a','red','shootout',5)]};
 const kick={id:'1',team:'A',playerId:'a',result:'scored',sequence:2};
 assert.equal(validateShootoutDraft(match,[kick],roster).penA,1);
 assert.throws(()=>validateShootoutDraft(match,[{...kick,sequence:6}],roster),/Thẻ đỏ/);
 assert.equal(shootoutRestrictions(match,roster).get('A@@a'),'Thẻ đỏ trực tiếp');
});
