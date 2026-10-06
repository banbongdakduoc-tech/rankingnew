import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,applyCommand,publicState,validateBackup,exportBackup} from '../server/services/stateEngine.js';
import {generateRoundRobinMatches,generateKnockoutPairs,calculateGroupStandings,getTopScorers,isGroupStageFinished,orderKnockoutRound,disciplineMatchSource,detectViolations} from '../shared/tournament.js';
const admin={username:'admin',role:'admin'},staff={username:'sec',role:'referee'};
const signature='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
test('End-to-end logic: 4 bảng → 24 trận duyệt → tứ kết → bán kết → chung kết/luân lưu → sao lưu/reset',()=>{
 const groups=['A','B','C','D'].map(g=>({groupName:`Bảng ${g}`,teams:Array.from({length:4},(_,i)=>g+(i+1))}));
 const players=Object.fromEntries(groups.flatMap(g=>g.teams.map(team=>[team,Array.from({length:10},(_,i)=>({id:`${team}_${i}`,team,num:i+1,name:`Cầu thủ ${team} ${i+1}`,avatar:''}))])));
 const matches=generateRoundRobinMatches(groups);
 Object.values(matches).forEach((m,i)=>Object.assign(m,{date:new Date(Date.UTC(2026,9,1)+i*3*3600000).toISOString(),venue:'Sân test',assignedSecretary:'sec'}));
 let s=initialState({tourStatus:'active',groupsData:groups,tourConfig:{numGroups:4},players,matches,accounts:{admin:{role:'admin'},sec:{role:'referee'}}});
 const patch=(patches,user=admin)=>{s=applyCommand(s,{kind:'patch',id:crypto.randomUUID(),expectedVersion:s._version,versions:Object.fromEntries(Object.values(s.matches).map(m=>[m.id,m.version||0])),patches},user);};
 const play=(id,winner,shootout=false)=>{
  let m=s.matches[id];patch({[`matches/${id}/status`]:'Đang LIVE'},staff);
  const teams=shootout?[m.home,m.away]:[winner];
  const events=teams.map((team,i)=>({id:crypto.randomUUID(),type:'goal',detail:'normal',team,playerId:s.players[team][0].id,player:`1 - ${s.players[team][0].name}`,minute:10+i,period:1}));
  s=applyCommand(s,{kind:'events',id:crypto.randomUUID(),matchId:id,baseVersion:s.matches[id].version,add:events},staff);
  if(shootout){const outcomes=[['home','scored'],['away','scored'],['home','scored'],['away','missed'],['home','scored'],['away','missed'],['home','scored']];const kicks=outcomes.map(([side,result],i)=>({id:crypto.randomUUID(),team:m[side],playerId:s.players[m[side]][Math.floor(i/2)].id,result,sequence:i+1}));patch({[`matches/${id}/shootout`]:kicks},staff);}
  patch({[`matches/${id}/status`]:'Chờ duyệt',[`matches/${id}/signatures`]:{home:signature,away:signature,referee:signature}},staff);
  assert.equal(publicState(s).matches[id].status,'Chờ duyệt');
  patch({[`matches/${id}/status`]:'Đã xong'});
  assert.equal(s.matches[id].scoreA,shootout?1:m.home===winner?1:0);
 };
 for(const m of Object.values(s.matches))play(m.id,[m.home,m.away].sort()[0]);
 assert.ok(isGroupStageFinished(Object.values(s.matches)));assert.equal(Object.values(s.matches).length,24);
 assert.equal(getTopScorers(Object.values(s.matches),s.players).reduce((n,p)=>n+p.goals,0),24);
 const pairs=generateKnockoutPairs(groups,Object.values(s.matches));assert.equal(pairs.length,4);
 const make=(id,round,home,away,hour,sourceHome,sourceAway)=>({id,round,group:'Vòng Knock-out',home,away,date:new Date(Date.UTC(2026,9,6)+hour*3600000).toISOString(),assignedSecretary:'sec',venue:'Sân test',status:'Sắp diễn ra',scoreA:0,scoreB:0,penA:'',penB:'',events:[],version:0,sourceHome,sourceAway});
 const qfs=pairs.map((p,i)=>{const source=team=>{const group=groups.find(g=>g.teams.includes(team));return {groupName:group.groupName,rank:calculateGroupStandings(group.teams,Object.values(s.matches).filter(m=>m.group===group.groupName)).findIndex(r=>r.name===team)};};return make(`qf${i+1}`,p.label,p.home,p.away,(3-i)*4,source(p.home),source(p.away));});
 patch(Object.fromEntries([...qfs].reverse().map(m=>[`matches/${m.id}`,m])));
 const ordered=orderKnockoutRound(Object.values(s.matches).filter(m=>m.round?.startsWith('Tứ Kết')));assert.deepEqual(ordered.map(m=>m.id),['qf1','qf2','qf3','qf4']);
 for(const m of ordered)play(m.id,m.home);
 const sf=[0,1].map(i=>{const a=s.matches[ordered[i*2].id],b=s.matches[ordered[i*2+1].id];return make(`sf${i+1}`,`Bán Kết ${i+1}`,a.advancingTeam,b.advancingTeam,48+i*4,{matchId:a.id,outcome:'winner'},{matchId:b.id,outcome:'winner'});});
 patch(Object.fromEntries(sf.map(m=>[`matches/${m.id}`,m])));for(const m of sf)play(m.id,m.home);
 const a=s.matches.sf1,b=s.matches.sf2;
 const final=make('final','Chung Kết',a.advancingTeam,b.advancingTeam,100,{matchId:a.id,outcome:'winner'},{matchId:b.id,outcome:'winner'});
 const third=make('third','Tranh Hạng 3',a.away,b.away,96,{matchId:a.id,outcome:'loser'},{matchId:b.id,outcome:'loser'});
 patch({'matches/final':final,'matches/third':third});play('third',third.home);play('final',final.home,true);
 assert.equal(s.matches.final.penA,4);assert.equal(s.matches.final.penB,1);assert.equal(s.matches.final.advancingTeam,final.home);
 assert.equal(getTopScorers([s.matches.final],s.players).reduce((n,p)=>n+p.goals,0),2);
 patch({'tourStatus':'completed'});assert.equal(Object.values(s.matches).length,32);
 assert.equal(Object.keys(validateBackup(exportBackup(s),s.accounts).matches).length,32);
 assert.throws(()=>applyCommand(s,{kind:'reopen',id:'reopen-live-tree',matchId:'sf1',version:s.matches.sf1.version,reason:'Đối chiếu'},admin),/phụ thuộc/);
 const reset=applyCommand(s,{kind:'reset',id:'reset',expectedVersion:s._version,confirmation:s.tourConfig.name},admin);
 assert.equal(Object.keys(reset.matches).length,0);assert.equal(Object.keys(reset.seasons).length,1);assert.deepEqual(reset.accounts,s.accounts);
});
test('Nguồn cảnh báo đỏ/vàng thứ hai/tích lũy xác định đúng trận và còn tên sau đổi lịch/xóa nguồn',()=>{
 const first={id:'first',home:'A',away:'B',date:'2026-10-01T01:00Z',status:'Đã xong',round:'Vòng 1',group:'A',events:[{id:'y1',type:'card',detail:'yellow',team:'A',player:'P',playerId:'p',minute:5,displayMinute:"5'"}]};
 const second={...first,id:'second',home:'A',away:'C',date:'2026-10-02T01:00Z',round:'Vòng 2',events:[{id:'red',type:'card',detail:'red',team:'A',player:'Q',playerId:'q',minute:15,displayMinute:"15'"},{id:'y2',type:'card',detail:'yellow',team:'A',player:'P',playerId:'p',minute:20}]};
 const v=detectViolations([second,first]);for(const alert of v){assert.equal(alert.matchId,'second');const source=disciplineMatchSource([second,first],alert);assert.equal(source.name,'A vs C');assert.equal(source.number,2);}
 assert.equal(disciplineMatchSource([first,second],v.find(a=>a.kind==='direct_red')).minute,"15'");
 const fallback=disciplineMatchSource([],{...v[0],matchRound:'Vòng 2',matchDate:second.date});assert.equal(fallback.name,'A vs C');assert.equal(fallback.id,'second');
 const two={...first,id:'two',events:[...first.events,{...first.events[0],id:'second-yellow',detail:'second_yellow_red',minute:12}]};assert.equal(detectViolations([two])[0].matchId,'two');
});

for(const count of [1,2,4])for(const format of ['quarter','semi'])test(`Nhánh ${format}: ${count} bảng, đủ suất và đúng seed`,()=>{
 const total=format==='quarter'?8:4,per=total/count;
 const groups=Array.from({length:count},(_,g)=>({groupName:`Bảng ${g}`,teams:Array.from({length:Math.max(per,4)},(_,i)=>`${g}-${i}`)}));
 const games=Object.values(generateRoundRobinMatches(groups)).map(m=>({...m,status:'Đã xong',scoreA:m.home<m.away?1:0,scoreB:m.home<m.away?0:1}));
 const pairs=generateKnockoutPairs(groups,games,format);assert.equal(pairs.length,total/2);assert.equal(new Set(pairs.flatMap(p=>[p.home,p.away])).size,total);
 for(const team of pairs.flatMap(p=>[p.home,p.away]))assert.ok(Number(team.split('-')[1])<per);
 const expected=count===1?(format==='quarter'?[['0-0','0-7'],['0-3','0-4'],['0-1','0-6'],['0-2','0-5']]:[['0-0','0-3'],['0-1','0-2']]):count===2?(format==='quarter'?[['0-0','1-3'],['1-1','0-2'],['1-0','0-3'],['0-1','1-2']]:[['0-0','1-1'],['1-0','0-1']]):format==='quarter'?[['0-0','1-1'],['2-0','3-1'],['1-0','0-1'],['3-0','2-1']]:[['0-0','3-0'],['1-0','2-0']];
 assert.deepEqual(pairs.map(p=>[p.home,p.away]),expected);
});
