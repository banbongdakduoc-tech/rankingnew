import test from 'node:test';
import assert from 'node:assert/strict';
import { numberMatchesBySchedule, calculateGroupStandings, calculateEventsGoals, detectViolations, getTopScorers, generateRoundRobinMatches, generateKnockoutPairs, compareEvents, parseMatchMinute, formatMatchMinute, elapsedClock, evaluateShootout, resolveWinner, validatePlayers } from '../shared/tournament.js';
const m=(id,home,away,scoreA,scoreB,events=[])=>({id,home,away,scoreA,scoreB,events,status:'Đã xong',group:'A',date:`2026-10-0${id}T08:00:00Z`});
const card=(id,detail,player='P',playerId='p')=>({id,type:'card',detail,team:'A',player,playerId,minute:5,period:1});
const permutations=a=>a.length<=1?[a]:a.flatMap((x,i)=>permutations(a.filter((_,j)=>i!==j)).map(p=>[x,...p]));
test('H2H tam giác ổn định với mọi hoán vị đội/trận',()=>{const games=[m('1','A','B',1,0),m('2','B','C',2,0),m('3','C','A',3,0)];for(const teams of permutations(['A','B','C']))for(const matches of permutations(games))assert.deepEqual(calculateGroupStandings(teams,matches).map(t=>t.name),['C','B','A']);});
test('H2H hai lượt tính đủ kết quả, không dùng trận đầu',()=>{const games=[m('1','A','B',2,0),m('2','B','A',3,0)];assert.equal(calculateGroupStandings(['A','B'],games)[0].name,'B');assert.equal(calculateGroupStandings(['A','B'],games.reverse())[0].name,'B');});
test('LIVE và chờ duyệt không thay BXH chính thức, tạm tính có nhãn riêng',()=>{const live={...m('1','A','B',1,0),status:'Chờ duyệt'};assert.equal(calculateGroupStandings(['A','B'],[live])[0].pts,0);assert.equal(calculateGroupStandings(['A','B'],[live],{provisional:true})[0].pts,3);});
test('Điểm 3/1/0 và tổng bàn đối xứng',()=>{const rows=calculateGroupStandings(['A','B','C'],[m('1','A','B',1,0),m('2','A','C',2,2)]);assert.equal(rows.find(r=>r.name==='A').pts,4);assert.equal(rows.reduce((a,r)=>a+r.gf,0),rows.reduce((a,r)=>a+r.ga,0));});
test('Bàn thường/penalty/phản lưới, loại luân lưu và event hủy',()=>{const events=[{type:'goal',detail:'normal',team:'A',player:'P'},{type:'goal',detail:'pen',team:'A',player:'P'},{type:'goal',detail:'own',team:'A',player:'P'},{type:'goal',detail:'shootout',team:'A',player:'P'},{type:'goal',detail:'normal',team:'A',player:'P',cancelled:true}];assert.deepEqual(calculateEventsGoals(events,'A','B'),{goalsA:2,goalsB:1});assert.equal(getTopScorers([m('1','A','B',2,1,events)])[0].goals,2);});
test('Hai vàng cùng trận có một truất quyền thi đấu',()=>{const a=detectViolations([m('1','A','B',0,0,[card('a','yellow'),{...card('b','yellow'),minute:15}])]);assert.equal(a.length,1);assert.equal(a[0].kind,'second_yellow');});
test('Đỏ trực tiếp không xóa vàng tích lũy',()=>{const a=detectViolations([m('1','A','B',0,0,[card('a','yellow')]),m('2','A','B',0,0,[card('b','red')]),m('3','A','B',0,0,[card('c','yellow')])]);assert.deepEqual(a.map(x=>x.kind),['direct_red','accumulation']);});
test('Tẩy vàng KO nhưng lịch sử giữ lại; có tùy chọn không tẩy',()=>{const games=[m('1','A','B',0,0,[card('a','yellow')]),{...m('2','A','B',0,0,[card('b','yellow')]),group:'Vòng Knock-out'}];assert.equal(detectViolations(games).length,0);assert.equal(detectViolations(games,{}, {resetYellowsAtKnockout:false}).length,1);});
test('Ân xá một vi phạm không che vi phạm khác cùng trận',()=>{const games=[m('1','A','B',0,0,[card('a','yellow'),{...card('b','yellow'),minute:10},{...card('c','red'),minute:15}])];const a=detectViolations(games);assert.equal(a.length,2);assert.equal(detectViolations(games,{[a[0].key]:true}).length,1);});
for(const n of [2,3,4,5,8])test(`Round robin ${n} đội: đủ cặp, không trùng vòng`,()=>{const matches=Object.values(generateRoundRobinMatches([{groupName:'A',teams:Array.from({length:n},(_,i)=>`T${i}`)}]));assert.equal(matches.length,n*(n-1)/2);const pairs=new Set(),rounds={};for(const m of matches){const key=[m.home,m.away].sort().join('|');assert.ok(!pairs.has(key));pairs.add(key);rounds[m.round]||=new Set();for(const team of [m.home,m.away]){assert.ok(!rounds[m.round].has(team));rounds[m.round].add(team);}}});
test('4 bảng 2 đội tạo đủ 8 suất không có placeholder',()=>{const groups=['A','B','C','D'].map(g=>({groupName:g,teams:[g+'1',g+'2']}));const matches=groups.map((g,i)=>({...m(String(i+1),g.teams[0],g.teams[1],1,0),group:g.groupName}));const pairs=generateKnockoutPairs(groups,matches);assert.equal(pairs.length,4);assert.equal(new Set(pairs.flatMap(p=>[p.home,p.away])).size,8);});
test('Không tạo knockout khi bảng chưa duyệt/thiếu suất',()=>{assert.throws(()=>generateKnockoutPairs([{groupName:'A',teams:['A','B']}],[]));assert.throws(()=>generateKnockoutPairs([{groupName:'A',teams:['A','B']}],[m('1','A','B',1,0)]));});
test('Bù giờ parse và timeline không trộn hai hiệp',()=>{assert.equal(parseMatchMinute('20+10').addedMinute,10);assert.throws(()=>parseMatchMinute('20+abc'));const a={id:'a',...parseMatchMinute('20+3',1)},b={id:'b',...parseMatchMinute('21',2)};assert.ok(compareEvents(a,b)<0);assert.equal(formatMatchMinute(2520,20,2).displayMinute,"40+2'");});
test('Đồng hồ qua background/F5 dựa vào mốc thời gian',()=>{const clock={elapsed:720,startedAt:100000,running:true,period:1};assert.equal(elapsedClock(clock,280000),900);assert.equal(elapsedClock({...clock,running:false},280000),720);});
test('Luân lưu kết thúc sớm 3–0 sau 3 lượt mỗi bên',()=>{const kicks=[];for(let i=0;i<3;i++){kicks.push({team:'A',result:'scored'},{team:'B',result:'missed'});}const r=evaluateShootout(kicks,'A','B');assert.equal(r.winner,'A');assert.throws(()=>evaluateShootout([...kicks,{team:'A',result:'scored'}],'A','B'));});
test('Đột tử chỉ kết thúc khi đủ một cặp lượt',()=>{const kicks=[];for(let i=0;i<5;i++)kicks.push({team:'A',result:'scored'},{team:'B',result:'scored'});assert.equal(evaluateShootout([...kicks,{team:'A',result:'scored'}],'A','B').winner,'');assert.equal(evaluateShootout([...kicks,{team:'A',result:'scored'},{team:'B',result:'missed'}],'A','B').winner,'A');});
test('Luân lưu cho phép đội khách sút trước, chặn hai lượt liên tiếp',()=>{assert.equal(evaluateShootout([{team:'B',result:'scored'}],'A','B').penB,1);assert.throws(()=>evaluateShootout([{team:'A',result:'scored'},{team:'A',result:'scored'}],'A','B'));});
test('Winner tách score trong trận; hòa aggregate không có winner',()=>{assert.equal(resolveWinner({home:'A',away:'B',scoreA:1,scoreB:1,penA:3,penB:3}),'');assert.equal(resolveWinner({home:'A',away:'B',scoreA:1,scoreB:2}),'B');});
test('Cầu thủ có ID ổn định khi đổi tên và số áo',()=>{const players=validatePlayers([{id:'p',num:10,name:'Tên cũ'}],'A');assert.equal(validatePlayers([{...players[0],num:11,name:'Tên mới'}],'A',players)[0].id,'p');assert.throws(()=>validatePlayers([{num:10,name:'P'},{num:10,name:'Q'}],'A'));assert.throws(()=>validatePlayers([{num:1,name:'P',avatar:'javascript:alert(1)'}],'A'));});
test('Thẻ vàng trong trận không gộp thành hai vàng với thẻ ở luân lưu',()=>{
  const m={id:'ko',home:'A',away:'B',group:'Vòng Knock-out',status:'Đã xong',events:[{id:'y1',type:'card',detail:'yellow',team:'A',player:'10 - P',playerId:'pa',minute:10,phase:'play'},{id:'y2',type:'card',detail:'yellow',team:'A',player:'10 - P',playerId:'pa',minute:40,phase:'shootout'}]};assert.equal(detectViolations([m]).length,0);
});
test('Bù giờ hiệp phụ dùng đúng mốc 45 và 50 ở thể thức 20+20+5+5',()=>{
  assert.equal(formatMatchMinute(46*60,20,3,5).displayMinute,"45+1'");assert.equal(formatMatchMinute(52*60,20,4,5).displayMinute,"50+2'");
});

test('STT toàn giải liên tục theo lịch, gồm knockout và giữ số khi lọc', () => {
  const games = [
    {id:'final',group:'Vòng Knock-out',round:'Chung Kết',date:'2026-10-20T08:00:00Z'},
    {id:'pending',group:'B',status:'Chờ duyệt',date:'2026-10-10T10:00:00+07:00'},
    {id:'first',group:'A',date:'2026-10-10T09:00'},
    {id:'semi',group:'Vòng Knock-out',round:'Bán Kết',date:'2026-10-19T08:00:00Z'},
  ];
  for (const input of permutations(games)) {
    const numbered = numberMatchesBySchedule(input);
    assert.deepEqual(numbered.map(m => [m.id,m.matchNumber]), [['first',1],['pending',2],['semi',3],['final',4]]);
    assert.deepEqual(numbered.filter(m => m.status !== 'Chờ duyệt').map(m => m.matchNumber),[1,3,4]);
  }
  assert.equal(games[0].matchNumber,undefined);
  assert.equal(numberMatchesBySchedule(games.map(m => m.id==='final'?{...m,date:'2026-10-09T08:00Z'}:m))[0].id,'final');
});
test('STT: trùng giờ ổn định, chưa xếp lịch ở cuối theo tiến trình knockout', () => {
  const games = [{id:'final',group:'Vòng Knock-out',round:'Chung Kết'}, {id:'third',group:'Vòng Knock-out',round:'Tranh Hạng 3'}, {id:'semi',group:'Vòng Knock-out',round:'Bán Kết'}, {id:'qf',group:'Vòng Knock-out',round:'Tứ Kết'}, {id:'match_10',date:'2026-10-10T08:00Z'}, {id:'match_2',date:'2026-10-10T08:00Z'}, {id:'group',date:'invalid'}];
  for (const input of [games,[...games].reverse()]) assert.deepEqual(numberMatchesBySchedule(input).map(m=>m.id),['match_2','match_10','group','qf','semi','third','final']);
  assert.deepEqual(numberMatchesBySchedule([]),[]);
});
