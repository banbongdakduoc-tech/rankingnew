import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { applyCommand, publicState, staffState, reportHash, exportBackup, validateBackup } from '../server/services/stateEngine.js';
const admin={username:'admin',role:'admin'},staff={username:'sec',role:'referee'},other={username:'other',role:'referee'};
const signature='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
import { fixture } from './helpers.js';

const event={id:'e1',type:'goal',detail:'normal',team:'A',player:'10 - P',playerId:'pa',minute:10,period:1};
const command=(patches,s,id=crypto.randomUUID())=>({kind:'patch',id,patches,expectedVersion:s._version,versions:Object.fromEntries(Object.entries(s.matches).map(([id,m])=>[id,m.version||0]))});
function add(s,event,id=crypto.randomUUID(),user=staff){return applyCommand(s,{kind:'events',id,matchId:'m',baseVersion:1,add:[event]},user);}
function submitted(){let s=add(fixture(),event);s=applyCommand(s,command({'matches/m/status':'Chờ duyệt','matches/m/signatures':{home:signature,away:signature,referee:signature}},s),staff);return s;}
test('Public DTO không chứa accounts, password, chữ ký hoặc ghi chú',()=>{const s=fixture();s.matches.m.signatures={home:signature};s.matches.m.secretaryNote='private';s.matches.m.signatureHash='private';const text=JSON.stringify(publicState(s));for(const value of ['never-public','private','accounts','signatures','signatureHash'])assert.ok(!text.includes(value));assert.equal(staffState(s,other).matches.m.signatures,undefined);});
test('Giả role frontend không thay quyền server; thư ký khác không sửa trận',()=>{assert.throws(()=>add(fixture(),event,'c',other),/phân công/);assert.throws(()=>applyCommand(fixture(),command({'accounts/evil':{}},fixture()),admin),/nhánh/);});
test('Append hai thiết bị không mất event, retry command không tạo trùng',()=>{let s=fixture();const cmd={kind:'events',id:'cmd1',matchId:'m',baseVersion:1,add:[event]};s=applyCommand(s,cmd,staff);const next=add(s,{...event,id:'e2',minute:11},'cmd2');assert.equal(next.matches.m.events.length,2);assert.equal(next.matches.m.scoreA,2);assert.deepEqual(applyCommand(next,cmd,staff),next);});
test('Event ID trùng nội dung khác bị chặn',()=>{const s=add(fixture(),event);assert.throws(()=>add(s,{...event,minute:11}),/tồn tại/);});
test('Event sai bị chặn; điểm danh không bắt buộc',()=>{for(const e of [{...event,team:'C'},{...event,detail:'shootout'},{...event,minute:-1}])assert.throws(()=>add(fixture(),e));const s=fixture();s.matches.m.lineupA=[];assert.equal(add(s,event).matches.m.scoreA,1);});
test('Vàng thứ hai được chuẩn hóa; bàn sau truất quyền bị chặn',()=>{let s=fixture();for(const [id,minute] of [['y1',5],['y2',8]])s=add(s,{...event,id,minute,type:'card',detail:'yellow'});assert.equal(s.matches.m.events[1].detail,'second_yellow_red');assert.throws(()=>add(s,event),/truất/);});
test('Hủy event giữ lịch sử, score giảm, lý do không mất',()=>{let s=add(fixture(),event);s=applyCommand(s,{kind:'events',id:'remove',matchId:'m',baseVersion:1,remove:['e1'],reason:'Ghi nhầm'},staff);assert.equal(s.matches.m.scoreA,0);assert.equal(s.matches.m.events[0].cancelled,true);assert.equal(s.matches.m.events[0].cancelReason,'Ghi nhầm');});
test('Staff không tự duyệt, không sửa cấu trúc trận',()=>{const s=submitted();assert.throws(()=>applyCommand(s,command({'matches/m/status':'Đã xong'},s),staff));assert.throws(()=>applyCommand(fixture(),command({'matches/m/home':'C'},fixture()),staff));});
test('Nộp thiếu chữ ký bị chặn; BTC được xét ngoại lệ có lý do',()=>{const s=fixture();assert.throws(()=>applyCommand(s,command({'matches/m/status':'Chờ duyệt'},s),staff),/chữ ký/);assert.equal(applyCommand(s,command({'matches/m/status':'Chờ duyệt','matches/m/signatureException':'Đội trưởng từ chối, trọng tài xác nhận'},s),admin).matches.m.status,'Chờ duyệt');});
test('Duyệt score không khớp không đổi DB',()=>{const s=submitted(),before=structuredClone(s);assert.throws(()=>applyCommand(s,command({'matches/m/status':'Đã xong','matches/m/scoreA':2},s),admin),/khớp/);assert.deepEqual(s,before);});
test('Sửa nội dung sau chữ ký phải ký lại hoặc có ngoại lệ',()=>{const s=submitted();assert.throws(()=>applyCommand(s,command({'matches/m/status':'Đã xong','matches/m/events':[{...event,minute:12}]},s),admin),/sau khi ký/);});
test('Duyệt hợp lệ, staff không sửa, BTC phải mở lại có reason',()=>{let s=submitted();assert.equal(s.matches.m.signatureHash,reportHash(s.matches.m));s=applyCommand(s,command({'matches/m/status':'Đã xong'},s),admin);assert.throws(()=>add(s,event),/không cho/);assert.throws(()=>applyCommand(s,command({'matches/m/date':'2026-10-03T08:00:00Z'},s),admin),/mở lại/);assert.throws(()=>applyCommand(s,{kind:'reopen',id:'r',matchId:'m',version:s.matches.m.version},admin),/lý do/);const reopened=applyCommand(s,{kind:'reopen',id:'r',matchId:'m',version:s.matches.m.version,reason:'Đối chiếu ghi nhầm'},admin);assert.equal(reopened.matches.m.revisions.length,1);assert.equal(reopened.matches.m.status,'Bị từ chối');});
test('Version conflict chặn ghi đè nhưng chuỗi offline của chính mình có thể tiếp tục',()=>{let s=fixture();const first=command({'matches/m/clock':{elapsed:10,running:false,period:1}},s,'one');s=applyCommand(s,first,staff);const second={...command({'matches/m/clock':{elapsed:20,running:false,period:1}},fixture(),'two'),predecessors:{m:'one'}};s=applyCommand(s,second,staff);assert.equal(s.matches.m.clock.elapsed,20);assert.throws(()=>applyCommand(s,command({'matches/m/clock':{elapsed:30,running:false,period:1}},fixture()),staff),/thiết bị khác/);});
test('Án cấm giữ qua knockout, không cho điểm danh',()=>{const s=fixture();s.suspensions['A@@pa']={reason:'Đỏ',team:'A',remainingMatches:1};assert.throws(()=>applyCommand(s,command({'matches/m/status':'Đang LIVE'},s),staff),/treo giò/);});
test('Phục hồi backup lỗi không ảnh hưởng dữ liệu và không import account',()=>{const s=fixture(),before=structuredClone(s);assert.throws(()=>validateBackup({schemaVersion:2,groupsData:[],players:{},matches:{x:{id:'x',home:'X',away:'Y'}}}));assert.deepEqual(s,before);const backup=exportBackup(submitted());backup.accounts={evil:{role:'admin'}};const restored=applyCommand(submitted(),{kind:'restore',id:'restore',data:backup,expectedVersion:submitted()._version},admin);assert.equal(restored.accounts.evil,undefined);assert.ok(Object.keys(restored.backups).length);});
test('Không ghi trường signatureHash/version hoặc đổi điều lệ sau tác nghiệp',()=>{const s=fixture();assert.throws(()=>applyCommand(s,command({'matches/m/signatureHash':'fake'},s),admin),/kiểm toán/);assert.throws(()=>applyCommand(s,command({'tourConfig/halfDuration':30},s),admin),/điều lệ/);});
test('Xử thua không tạo bàn cá nhân giả',()=>{const s=submitted();const next=applyCommand(s,command({'matches/m/status':'Đã xong','matches/m/resultType':'forfeit','matches/m/scoreA':3,'matches/m/scoreB':0,'matches/m/administrativeReason':'B bỏ cuộc','matches/m/signatureException':'Quyết định BTC'},s),admin);assert.equal(next.matches.m.scoreA,3);assert.equal(next.matches.m.events.length,1);});
test('Winner sai bị chặn; KO hòa chưa luân lưu không duyệt',()=>{let s=submitted();s.matches.m.group='Vòng Knock-out';s.matches.m.signatureHash=reportHash(s.matches.m);assert.throws(()=>applyCommand(s,command({'matches/m/status':'Đã xong','matches/m/advancingTeam':'B'},s),admin),/khớp/);s.matches.m.events=[];s.matches.m.scoreA=0;s.matches.m.signatureHash=reportHash(s.matches.m);assert.throws(()=>applyCommand(s,command({'matches/m/status':'Đã xong'},s),admin),/phân thắng/);});
test('Mở lại kết quả khóa trận phụ thuộc chưa bắt đầu; chặn nếu LIVE',()=>{let s=submitted();s.matches.m.group='Vòng Knock-out';s.matches.m.signatureHash=reportHash(s.matches.m);s=applyCommand(s,command({'matches/m/status':'Đã xong'},s),admin);s.matches.child={id:'child',home:'A',away:'C',group:'Vòng Knock-out',status:'Sắp diễn ra',sourceHome:{matchId:'m',outcome:'winner'},version:0};const cmd={kind:'reopen',id:'open',matchId:'m',version:s.matches.m.version,reason:'Sai scorer'};const next=applyCommand(s,cmd,admin);assert.equal(next.matches.child.sourcePending,true);s.matches.child.status='Đang LIVE';assert.throws(()=>applyCommand(s,cmd,admin),/phụ thuộc/);});
test('Đội hình giả ID, trùng cầu thủ hoặc sửa hồ sơ đã tham gia bị chặn',()=>{
  const s=fixture();for(const lineup of [[{id:'fake',num:10,name:'P',played:true}],[...s.matches.m.lineupA,...s.matches.m.lineupA]])assert.throws(()=>applyCommand(s,command({'matches/m/lineupA':lineup},s),admin),/Đội hình/);
  assert.throws(()=>applyCommand(s,command({'players/A':[]},s),admin),/biên bản/);
});
test('Reset có backup và giữ tài khoản, không xóa lịch sử audit',()=>{
  const s=submitted();const cmd={id:'reset',kind:'reset',expectedVersion:s._version,confirmation:s.tourConfig.name};const next=applyCommand(s,cmd,admin);
  assert.equal(next.tourStatus,'none');assert.deepEqual(next.matches,{});assert.deepEqual(next.accounts,s.accounts);assert.equal(Object.values(next.backups)[0].snapshot.matches.m.scoreA,1);assert.equal(next.audit.length,s.audit.length+1);
  assert.throws(()=>applyCommand(s,{...cmd,confirmation:'wrong'},admin));
});
test('Bù giờ âm bị chặn, 20+3 đứng trước 20+4 dù displayMinute thiếu',()=>{
  assert.throws(()=>add(fixture(),{...event,addedMinute:-1}),/Bù giờ/);
  let s=add(fixture(),{...event,id:'later',minute:20,addedMinute:4});s=add(s,{...event,id:'earlier',minute:20,addedMinute:3});assert.deepEqual(s.matches.m.events.map(e=>e.id),['earlier','later']);
});
test('Luân lưu 3 lượt đúng winner; không lặp người sút trước khi đủ vòng',()=>{
  const s=submitted();s.tourConfig.shootoutRounds=3;s.players.A.push({id:'pa2',team:'A',num:11,name:'P2',avatar:''});s.matches.m.lineupA.push({id:'pa2',num:11,name:'P2',played:true});s.matches.m.group='Vòng Knock-out';s.matches.m.events=[];s.matches.m.scoreA=0;
  const kick=(id,team,playerId,result)=>({id,team,playerId,result});
  const duplicate=[kick('a1','A','pa','scored'),kick('b1','B','pb','missed'),kick('a2','A','pa','scored')];assert.throws(()=>applyCommand(s,command({'matches/m/shootout':duplicate},s),admin),/sút lần nữa/);
  const valid=[kick('a1','A','pa','scored'),kick('b1','B','pb','missed'),kick('a2','A','pa2','scored'),kick('b2','B','pb','missed')];
  const next=applyCommand(s,command({'matches/m/shootout':valid,'matches/m/status':'Đã xong','matches/m/signatureException':'Trọng tài xác nhận'},s),admin);assert.equal(next.matches.m.advancingTeam,'A');assert.equal(next.matches.m.penA,2);assert.equal(next.matches.m.scoreA,0);
});
test('Án một trận chỉ trừ một lần khi duyệt, không trừ khi xử thua',()=>{
  const s=submitted();s.players.A.push({id:'pa2',team:'A',num:12,name:'Ban player',avatar:''});s.suspensions['A@@pa2']={team:'A',reason:'Đỏ',remainingMatches:1,matchId:'source'};
  const next=applyCommand(s,command({'matches/m/status':'Đã xong'},s),admin);assert.equal(next.suspensions['A@@pa2'].remainingMatches,0);
  const forfeit=applyCommand(s,command({'matches/m/status':'Đã xong','matches/m/resultType':'forfeit','matches/m/administrativeReason':'Bỏ cuộc','matches/m/signatureException':'BTC'},s),admin);assert.equal(forfeit.suspensions['A@@pa2'].remainingMatches,1);
});
test('Nguồn bracket tự tham chiếu và đội trùng trong cùng vòng bị chặn',()=>{
  const s=fixture();const upcoming={id:'ko',group:'Vòng Knock-out',round:'Tứ Kết 1',home:'C',away:'D',status:'Sắp diễn ra',events:[],scoreA:0,scoreB:0,sourceHome:{matchId:'ko',outcome:'winner'}};
  assert.throws(()=>applyCommand(s,command({'matches/ko':upcoming},s),admin),/Nguồn/);
});
test('Đổi tên/số áo giữ ID và snapshot biên bản cũ',()=>{
  const s=submitted();const next=applyCommand(s,command({'players/A':[{...s.players.A[0],num:11,name:'New name'}]},s),admin);assert.equal(next.players.A[0].id,'pa');assert.equal(next.matches.m.events[0].player,'10 - P');assert.deepEqual(next.players.A[0].profileHistory,[{num:10,name:'P'}]);
  assert.equal(applyCommand(next,command({'matches/m/status':'Đã xong'},next),admin).matches.m.status,'Đã xong');
});
test('Reset lưu hồ sơ mùa giải công khai không có chữ ký/tài khoản',()=>{
  const s=submitted();const next=applyCommand(s,{id:'season-reset',kind:'reset',expectedVersion:s._version,confirmation:s.tourConfig.name},admin);const season=Object.values(next.seasons)[0];assert.equal(season.data.matches.m.scoreA,1);assert.equal(season.data.matches.m.signatures,undefined);assert.equal(season.data.accounts,undefined);assert.equal(publicState(next).seasonHistory[0].name,s.tourConfig.name);
});
test('Cấu hình hiệp phụ: hòa KO chưa hết hiệp phụ không được duyệt',()=>{
  const s=submitted();s.tourConfig.extraTimeMinutes=5;s.matches.m.group='Vòng Knock-out';s.matches.m.events=[];s.matches.m.scoreA=0;s.matches.m.signatureHash=reportHash(s.matches.m);assert.throws(()=>applyCommand(s,command({'matches/m/status':'Đã xong'},s),admin),/hiệp phụ/);
});
test('Thẻ luân lưu không bị chuẩn hóa thành vàng thứ hai của thẻ trong trận',()=>{
  let s=fixture();s.matches.m.group='Vòng Knock-out';s=add(s,{...event,id:'y-play',type:'card',detail:'yellow',phase:'play'});s=add(s,{...event,id:'y-shoot',type:'card',detail:'yellow',phase:'shootout',minute:40,period:2});assert.equal(s.matches.m.events[1].detail,'yellow');
});
test('Đội trùng ở Tứ Kết 1 và Tứ Kết 2 bị chặn',()=>{
  const s=fixture();const ko={id:'ko1',group:'Vòng Knock-out',round:'Tứ Kết 1',home:'A',away:'C',status:'Sắp diễn ra',scoreA:0,scoreB:0,events:[]};assert.throws(()=>applyCommand(s,command({'matches/ko1':ko,'matches/ko2':{...ko,id:'ko2',round:'Tứ Kết 2',away:'D'}},s),admin),/hai lần/);
});
test('Mở lại hủy chữ ký cũ, giữ chữ ký trong snapshot trước sửa',()=>{
  let s=submitted();s=applyCommand(s,command({'matches/m/status':'Đã xong'},s),admin);const next=applyCommand(s,{id:'clear-signatures',kind:'reopen',matchId:'m',version:s.matches.m.version,reason:'Sửa bàn ghi nhầm'},admin);assert.equal(next.matches.m.signatures,null);assert.equal(next.matches.m.signatureHash,null);assert.equal(next.matches.m.revisions[0].match.signatures.home,signature);assert.throws(()=>applyCommand(next,command({'matches/m/status':'Đã xong'},next),admin),/chữ ký/);
});
test('Public DTO allowlist cả dữ liệu lồng nhau, không lộ field riêng trong event/config/player',()=>{
  const s=submitted();s.matches.m.events[0].privateNote='secret-private';s.players.A[0].privateNote='secret-private';s.tourConfig.privateKey='secret-private';s.matches.m.clock={elapsed:0,period:1,running:false,privateNote:'secret-private'};assert.ok(!JSON.stringify(publicState(s)).includes('secret-private'));
});
test('Lịch trùng sân và nghỉ quá ngắn bị chặn trước lưu',()=>{
  const s=fixture(),m2={id:'m2',home:'C',away:'D',group:'A',round:'Vòng 1',date:'2026-10-02T08:30:00Z',venue:'One',status:'Sắp diễn ra',scoreA:0,scoreB:0,events:[]};
  assert.throws(()=>applyCommand(s,command({'matches/m/date':'2026-10-02T08:00:00Z','matches/m/venue':'One','matches/m2':m2},s),admin),/Trùng sân/);
  assert.throws(()=>applyCommand(s,command({'matches/m/date':'2026-10-02T08:00:00Z','matches/m2':{...m2,home:'A',away:'C',venue:'Two',date:'2026-10-02T09:40:00Z'}},s),admin),/nghỉ/);
});
test('Không giảm án khi cầu thủ còn án vẫn thi đấu hoặc duyệt muộn trận trước nguồn án',()=>{
  const s=submitted();s.suspensions['A@@pa']={team:'A',reason:'Đỏ',remainingMatches:1,matchId:'source'};const next=applyCommand(s,command({'matches/m/status':'Đã xong'},s),admin);assert.equal(next.suspensions['A@@pa'].remainingMatches,1);assert.deepEqual(next.suspensions['A@@pa'].eligibilityConflicts,['m']);
  const early=submitted();early.players.A.push({id:'pa2',team:'A',num:12,name:'Ban player',avatar:''});early.matches.m.date='2026-10-02T01:00:00.000Z';early.matches.m.signatureHash=reportHash(early.matches.m);early.matches.source={...fixture().matches.m,id:'source',status:'Đã xong',date:'2026-10-03T01:00:00Z'};early.suspensions['A@@pa2']={team:'A',reason:'Đỏ',remainingMatches:1,matchId:'source'};assert.equal(applyCommand(early,command({'matches/m/status':'Đã xong'},early),admin).suspensions['A@@pa2'].remainingMatches,1);
});
test('Đồng hồ lệch giờ client được chuẩn hóa server, gồm thời gian offline chờ gửi',()=>{
  const s=fixture(),now=Date.now(),clientNow=now+3600000;const cmd=command({'matches/m/clock':{elapsed:60,running:true,period:1,startedAt:clientNow-120000}},s);cmd.clientNow=clientNow;
  const next=applyCommand(s,cmd,staff),clock=next.matches.m.clock;assert.equal(clock.elapsed,180);assert.equal(clock.timeBasis,'server');assert.ok(Math.abs(clock.startedAt-now)<1000);assert.equal(applyCommand(next,cmd,staff).matches.m.clock.elapsed,180);
});

test('Bắt đầu trận không điểm danh; treo giò vẫn chặn ghi bàn',()=>{
  let s=fixture();s.matches.m.status='Sắp diễn ra';s.matches.m.lineupA=[];s.matches.m.lineupB=[];
  s=applyCommand(s,command({'matches/m/status':'Đang LIVE'},s),staff);assert.equal(s.matches.m.status,'Đang LIVE');
  s.suspensions['A@@pa']={team:'A',playerId:'pa',reason:'Đỏ',remainingMatches:1,matchId:'previous'};
  assert.throws(()=>add(s,event),/treo giò/);
});
test('Logo và đơn vị tổ chức công khai, chỉ nhận ảnh raster nén',()=>{
  const s=fixture();const next=applyCommand(s,command({'tourConfig/name':'Giải thử','tourConfig/organizer':'BTC thử','tourConfig/logo':signature},s),admin);
  assert.equal(publicState(next).tourConfig.organizer,'BTC thử');assert.equal(publicState(next).tourConfig.logo,signature);
  for(const logo of ['javascript:alert(1)','data:image/svg+xml;base64,aaa','x'.repeat(300001)])assert.throws(()=>applyCommand(s,command({'tourConfig/logo':logo},s),admin),/Logo/);
  assert.throws(()=>applyCommand(s,command({'tourConfig/name':''},s),admin),/Tên giải/);
});
test('Luân lưu không cần điểm danh, nhưng vẫn cấm cầu thủ bị truất quyền',()=>{
  const s=fixture();s.matches.m.group='Vòng Knock-out';s.matches.m.lineupA=[];s.matches.m.lineupB=[];
  const kick={id:'k1',team:'A',playerId:'pa',result:'scored',sequence:100};
  const next=applyCommand(s,command({'matches/m/shootout':[kick]},s),staff);assert.equal(next.matches.m.penA,1);
  s.matches.m.events=[{...event,type:'card',detail:'direct_red',sequence:50}];
  assert.throws(()=>applyCommand(s,command({'matches/m/shootout':[kick]},s),staff),/đủ điều kiện/);
});

const approveAsUI = (s, extra={}) => applyCommand(s,command({'matches/m/status':'Đã xong','matches/m/scoreA':s.matches.m.scoreA,'matches/m/scoreB':s.matches.m.scoreB,'matches/m/penA':s.matches.m.penA ?? '', 'matches/m/penB':s.matches.m.penB ?? '', 'matches/m/events':s.matches.m.events, 'matches/m/shootout':s.matches.m.shootout || [], 'matches/m/resultType':s.matches.m.resultType || 'played','matches/m/administrativeReason':s.matches.m.administrativeReason || '', 'matches/m/signatureException':'',...extra},s),admin);
const legacyReportHash=m=>createHash('sha256').update(JSON.stringify([m.home,m.away,m.date,m.ref,m.sec,m.venue,m.events||[],m.scoreA,m.scoreB,m.shootout||[],m.penA,m.penB,m.lineupA||[],m.lineupB||[],m.secretaryNote||'',m.resultType||'played',m.administrativeReason||''])).digest('hex');
test('BTC duyệt không sửa, luân lưu thiếu/null/trống: không cần ghi chú',()=>{
  for(const empty of [undefined,null,'']) {
    const s=submitted();s.matches.m.penA=empty;s.matches.m.penB=empty;
    for(const hash of [reportHash(s.matches.m),legacyReportHash(s.matches.m)]) {
      s.matches.m.signatureHash=hash;
      const next=approveAsUI(s);assert.equal(next.matches.m.status,'Đã xong');assert.equal(next.matches.m.signatureException,'');
      assert.throws(()=>approveAsUI(s,{'matches/m/events':[{...event,minute:12}]}),/sau khi ký/);
    }
  }
});
test('Đảo thứ tự key như Firebase không thay nội dung ký',()=>{
  const s=submitted();const reorder=v=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().reverse().map(k=>[k,reorder(v[k])])):v;
  s.matches.m=reorder(s.matches.m);
  assert.equal(approveAsUI(s).matches.m.status,'Đã xong');
  assert.throws(()=>approveAsUI(s,{'matches/m/secretaryNote':'BTC sửa nội dung'}),/sau khi ký/);
  assert.equal(approveAsUI(s,{'matches/m/events':[{...event,minute:12}],'matches/m/signatureException':'Đối chiếu phút ghi bàn với trọng tài'}).matches.m.status,'Đã xong');
});
test('Không sửa kết quả knockout, tự xác định winner: không cần ghi chú',()=>{
  const s=submitted();s.matches.m.group='Vòng Knock-out';s.matches.m.signatureHash=reportHash(s.matches.m);
  assert.equal(approveAsUI(s).matches.m.advancingTeam,'A');
});
