import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateState } from '../server/services/migrateState.js';
import { Database } from '../server/config/db.js';
import { fixture } from './helpers.js';
test('Migration ổn định ID cầu thủ, event, đội hình và luân lưu lịch sử',()=>{
  const raw={tourConfig:{halfDuration:20},players:{A:[{num:10,name:'P'}]},matches:{m:{id:'m',home:'A',away:'B',lineupA:[{num:10,name:'P',played:true}],events:[{team:'A',player:'10 - P',minute:20,displayMinute:"20+3'"}],penA:4,penB:3}}};
  const a=migrateState(raw),b=migrateState(a);assert.deepEqual(a,b);assert.equal(a.players.A[0].id,a.matches.m.events[0].playerId);assert.equal(a.matches.m.lineupA[0].id,a.players.A[0].id);assert.equal(a.matches.m.events[0].addedMinute,3);assert.equal(a.matches.m.legacyPenalty,true);assert.equal(raw.players.A[0].id,undefined);
});
test('Startup hash mật khẩu cũ và xóa plaintext cả khi đã có hash',async()=>{
  const data=fixture();data.accounts.old={role:'admin',password:'local-test-password'};data.accounts.admin.password='remove-me';const db=await new Database({mode:'memory',data}).init();assert.ok(db.get('accounts').old.passwordHash.startsWith('$2'));assert.equal(db.get('accounts').old.password,undefined);assert.equal(db.get('accounts').admin.password,undefined);
});
test('Nháp chữ ký cùng version được giữ khi server phát snapshot, version mới xóa chữ ký nháp cũ',async()=>{
  const {mergeMatchDraft}=await import('../shared/tournament.js');const current={id:'m',version:2,status:'Đang LIVE'};const draft={...current,signatures:{home:'test-local-stroke'}};
  assert.deepEqual(mergeMatchDraft(draft,current).signatures,draft.signatures);assert.equal(mergeMatchDraft(draft,{...current,version:3}).signatures,undefined);assert.equal(mergeMatchDraft(draft,{...current,status:'Chờ duyệt'}).signatures,undefined);
});
test('Thời gian UTC và giờ nhập VN round trip đúng, độc lập timezone thiết bị',async()=>{
  const {normalizeKickoff,kickoffInput}=await import('../shared/tournament.js');assert.equal(normalizeKickoff('2026-10-02T08:00'),'2026-10-02T01:00:00.000Z');assert.equal(kickoffInput('2026-10-02T01:00:00.000Z'),'2026-10-02T08:00');assert.throws(()=>normalizeKickoff('bad-date'));
});
