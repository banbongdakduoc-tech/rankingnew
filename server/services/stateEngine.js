import { createHash, randomUUID } from 'node:crypto';
import { calculateEventsGoals, calculateGroupStandings, compareEvents, resolveWinner, evaluateShootout, validatePlayers, detectViolations, DEFAULT_RULES, isKnockout, normalizeKickoff } from '../../shared/tournament.js';

export class DomainError extends Error { constructor(message, status = 422) { super(message); this.status=status; } }
const fail=(message,status) => {throw new DomainError(message,status);};
const integer=(v,label) => {if(v===''||v==null||!Number.isInteger(Number(v))||Number(v)<0)fail(`${label} phải là số nguyên không âm.`);return Number(v);};
const safeKey=(s) => typeof s==='string' && s.length>0 && s.length<=160 && !['.', '#', '$', '[', ']', '/'].some(c => s.includes(c)) && !['__proto__','constructor','prototype'].includes(s);
export const DEFAULT_STATE={schemaVersion:2,_version:0,tourStatus:'none',tourConfig:{name:'Dược Premier League 2026',format:'group',numGroups:2,knockoutFormat:'quarter',halfDuration:20,...DEFAULT_RULES},groupsData:[],matches:{},players:{},suspensions:{},handledViolations:{},accounts:{},seasons:{},audit:[],receipts:{},backups:{}};
export function initialState(data = {}) { const state = structuredClone({...DEFAULT_STATE,...data,tourConfig:{...DEFAULT_STATE.tourConfig,...data.tourConfig}}); for (const key of ['matches','players','suspensions','handledViolations','accounts','seasons','receipts','backups']) state[key] ||= {}; state.groupsData ||= []; state.audit ||= []; return state; }
const pick=(value,fields)=>Object.fromEntries(fields.filter(f=>value?.[f]!==undefined).map(f=>[f,value[f]]));
export function publicState(data) {
  const matches=Object.fromEntries(Object.entries(data.matches || {}).map(([id,m])=>{
    // Explicit allowlist: public results never carry signatures, account data or staff notes.
    const fields=['id','group','round','roundNumber','home','away','date','venue','status','scoreA','scoreB','penA','penB','events','advancingTeam','clock','version','resultType','administrativeReason','shootout','shootoutRounds','sourceHome','sourceAway'];
    const out=pick(m,fields);out.events=(m.events||[]).map(e=>pick(e,['id','type','detail','team','player','playerId','minute','addedMinute','period','displayMinute','phase','sequence','cancelled']));
    if(m.shootout)out.shootout=m.shootout.map(k=>pick(k,['id','team','playerId','player','result','sequence','cancelled']));
    if(m.clock)out.clock=pick(m.clock,['elapsed','startedAt','period','running','timeBasis']);return [id,out];
  }));
  return {serverTime:Date.now(),seasonHistory:Object.values(data.seasons || {}).map(s=>({id:s.id,name:s.name,at:s.at})),schemaVersion:2,_version:data._version || 0,tourStatus:data.tourStatus,tourConfig:pick(data.tourConfig,['name','format','numGroups','knockoutFormat','halfDuration',...Object.keys(DEFAULT_RULES),'minRestMinutes']),groupsData:data.groupsData,players:Object.fromEntries(Object.entries(data.players||{}).map(([team,list])=>[team,list.map(p=>pick(p,['id','team','num','name','shirtName','avatar']))])),matches,suspensions:Object.fromEntries(Object.entries(data.suspensions||{}).map(([key,ban])=>[key,pick(ban,['team','playerId','player','reason','remainingMatches','totalMatches','needsReview'])]))};
}
export function staffState(data,user) {
  const out=publicState(data);
  out.matches=Object.fromEntries(Object.entries(data.matches || {}).map(([id,m])=>[id,canOperate(m,user)?structuredClone(m):out.matches[id]]));out.handledViolations=data.handledViolations || {};
  if(user.role==='admin'){out.suspensions=structuredClone(data.suspensions||{});out.players=structuredClone(data.players||{});out.audit=(data.audit||[]).slice(-300);out.backupHistory=Object.values(data.backups||{}).map(b=>({id:b.id,at:b.at,reason:b.reason}));}
  return out;
}
export function reportHash(m) {
  return createHash('sha256').update(JSON.stringify([m.home,m.away,m.date,m.ref,m.sec,m.venue,m.events||[],m.scoreA,m.scoreB,m.shootout||[],m.penA,m.penB,m.lineupA||[],m.lineupB||[],m.secretaryNote||'',m.resultType||'played',m.administrativeReason||''])).digest('hex');
}
export function canOperate(m,user) { return user.role==='admin' || user.role==='referee' && m.assignedSecretary===user.username; }
function validateMatch(m,state,{approval=false,submission=false}={}) {
  if(!safeKey(m.home)||!safeKey(m.away)||m.home===m.away)fail('Hai đội phải hợp lệ và khác nhau.');
  const allTeams=state.groupsData.flatMap(g=>g.teams || []);
  if(!allTeams.includes(m.home)||!allTeams.includes(m.away))fail('Đội không có trong danh sách giải.');
  m.scoreA=integer(m.scoreA ?? 0,'Tỷ số A');m.scoreB=integer(m.scoreB ?? 0,'Tỷ số B');
  if(!['played','forfeit'].includes(m.resultType || 'played'))fail('Loại kết quả không hợp lệ.');
  if(m.date){try{m.date=normalizeKickoff(m.date);}catch{fail('Ngày giờ trận không hợp lệ.');}}
  if(m.assignedSecretary && state.accounts[m.assignedSecretary]?.role!=='referee')fail('Tài khoản thư ký được phân công không hợp lệ.');
  for(const [side,team] of [['lineupA',m.home],['lineupB',m.away]]) {
    if(!Array.isArray(m[side] || []))fail('Đội hình không hợp lệ.');
    const seen=new Set();
    for(const entry of m[side] || []) {
      const p=(state.players[team] || []).find(p=>entry.id ? p.id===entry.id : Number(p.num)===Number(entry.num)&&p.name===entry.name);
      if(!p||seen.has(p.id)||typeof entry.played!=='boolean')fail('Đội hình có cầu thủ không hợp lệ hoặc bị trùng.');
      if(![{num:p.num,name:p.name},...(p.profileHistory||[])].some(x=>Number(entry.num)===Number(x.num)&&entry.name===x.name))fail('Thông tin đội hình không khớp hồ sơ cầu thủ.');
      entry.id=p.id;seen.add(p.id);
    }
  }
  const ids=new Set(), dismissals=new Map(), yellows=new Map();
  m.events=(m.events || []).slice().sort(compareEvents);
  for(const e of m.events) {
    if(!e.id||ids.has(String(e.id)))fail('Mã sự kiện thiếu hoặc bị trùng.');ids.add(String(e.id));
    if(!['goal','card'].includes(e.type)||!['normal','pen','penalty','own','Vàng','yellow','Đỏ','red','direct_red','second_yellow_red'].includes(e.detail || 'normal'))fail('Loại sự kiện không hợp lệ.');
    if(e.type==='goal'&&!['normal','pen','penalty','own'].includes(e.detail || 'normal') || e.type==='card'&&!['Vàng','yellow','Đỏ','red','direct_red','second_yellow_red'].includes(e.detail))fail('Chi tiết không phù hợp loại sự kiện.');
    if(e.phase==='shootout'&&(e.type!=='card'||!isKnockout(m)||m.scoreA!==m.scoreB))fail('Chỉ ghi thẻ phase luân lưu ở knockout hòa; cú sút lưu riêng.');
    if(e.phase&&!['play','shootout'].includes(e.phase))fail('Phase sự kiện không hợp lệ.');
    if(![m.home,m.away].includes(e.team))fail('Sự kiện thuộc đội ngoài trận.');
    integer(e.addedMinute ?? 0,'Bù giờ');if(Number(e.addedMinute || 0)>99)fail('Bù giờ tối đa 99 phút.');
    integer(e.minute,'Phút');if(Number(e.minute)<1||Number(e.minute)>300)fail('Phút phải nằm trong khoảng 1–300.');
    if(!e.period)e.period=Number(e.minute)>Number(state.tourConfig.halfDuration)?2:1;
    if(![1,2,3,4].includes(e.period))fail('Hiệp không hợp lệ.');
    const p=(state.players[e.team]||[]).find(p=>e.playerId ? p.id===e.playerId : `${p.num} - ${p.name}`===e.player || p.name===e.player);
    if(!p)fail(`Không tìm thấy cầu thủ ${e.player || ''}.`);
    e.playerId=p.id;
    const key=`${e.team}@@${p.id}`;
    if(e.cancelled)continue;
    if(e.type==='goal' && dismissals.has(key))fail(`Cầu thủ ${e.player} đã bị truất quyền thi đấu trước bàn thắng.`);
    if(e.type==='goal' && !(m[e.team===m.home?'lineupA':'lineupB']||[]).some(x=>x.played&&(x.id===p.id||Number(x.num)===Number(p.num)&&x.name===p.name)))fail(`Cầu thủ ${e.player} chưa được điểm danh ra sân.`);
    if(e.type==='card' && ['Vàng','yellow','second_yellow_red'].includes(e.detail)) {
      const cardKey=`${key}@@${e.phase==='shootout'?'shootout':'play'}`;const n=(yellows.get(cardKey)||0)+1;yellows.set(cardKey,n);
      if(n>2)fail('Cầu thủ đã nhận đủ hai vàng trong trận.');
      if(e.detail==='second_yellow_red'&&n!==2)fail('Phải có thẻ vàng thứ nhất trước vàng thứ hai.');
      if(n===2){e.detail='second_yellow_red';dismissals.set(key,{phase:e.phase,sequence:e.sequence || 0});}
    }
    if(e.type==='card' && ['Đỏ','red','direct_red'].includes(e.detail))dismissals.set(key,{phase:e.phase,sequence:e.sequence || 0});
  }
  if(m.resultType==='forfeit') { if(!m.administrativeReason?.trim())fail('Kết quả hành chính cần lý do.'); }
  else {
    const {goalsA,goalsB}=calculateEventsGoals(m.events,m.home,m.away);
    if(approval && (m.scoreA!==goalsA || m.scoreB!==goalsB))fail(`Tỷ số không khớp sự kiện: ${goalsA}–${goalsB}.`);
    if(!approval){m.scoreA=goalsA;m.scoreB=goalsB;}
  }
  if((m.events||[]).some(e=>!e.cancelled&&e.phase==='shootout')&&(!isKnockout(m)||m.scoreA!==m.scoreB))fail('Thẻ luân lưu chỉ có ở knockout hòa.');
  if((m.shootout?.length || submission || approval)&&isKnockout(m)&&m.scoreA===m.scoreB&&Number(state.tourConfig.extraTimeMinutes)>0&&m.resultType!=='forfeit'&&m.clock?.period!==4)fail('Hoàn thành hai hiệp phụ trước luân lưu/nộp trận hòa.');
  if(m.shootout?.length) {
    if(!isKnockout(m)||m.scoreA!==m.scoreB)fail('Chỉ sút luân lưu khi hòa ở knockout.');
    const kickIds=new Set(), cycles=new Map();
    for(const kick of m.shootout) {
      if(kick.cancelled||kick.result==='retake')continue;
      if(!kick.id||kickIds.has(kick.id))fail('Lượt luân lưu bị trùng.');kickIds.add(kick.id);
      if(!(state.players[kick.team]||[]).some(p=>p.id===kick.playerId))fail('Người sút luân lưu không hợp lệ.');
      const dismissed=dismissals.get(`${kick.team}@@${kick.playerId}`);
      const disqualified=p=>{const d=dismissals.get(`${kick.team}@@${p.id}`);return d&&(d.phase!=='shootout'||!kick.sequence||d.sequence<=kick.sequence);};
      if(!(m[kick.team===m.home?'lineupA':'lineupB']||[]).some(p=>p.id===kick.playerId&&p.played)||dismissed&&disqualified({id:kick.playerId}))fail('Người sút không đủ điều kiện.');
      const eligible=(m[kick.team===m.home?'lineupA':'lineupB']||[]).filter(p=>p.played&&!disqualified(p));
      const used=cycles.get(kick.team)||new Set();if(used.size===eligible.length)used.clear();
      if(used.has(kick.playerId))fail('Mọi cầu thủ đủ điều kiện phải sút trước khi một người sút lần nữa.');used.add(kick.playerId);cycles.set(kick.team,used);
    }
    m.shootoutRounds=Number(state.tourConfig.shootoutRounds);
    const shoot=evaluateShootout(m.shootout,m.home,m.away,state.tourConfig.shootoutRounds);m.penA=shoot.penA;m.penB=shoot.penB;
  } else if(m.penA!==''&&m.penA!=null || m.penB!==''&&m.penB!=null) {
    if(!m.legacyPenalty)fail('Ghi từng lượt luân lưu thay vì nhập tổng tỷ số.');
    integer(m.penA,'Luân lưu A');integer(m.penB,'Luân lưu B');
  }
  if(approval && isKnockout(m)) {
    const winner=resolveWinner(m);if(!winner)fail('Knockout chưa phân thắng bại.');
    if(m.advancingTeam && m.advancingTeam!==winner)fail('Đội thắng không khớp kết quả.');m.advancingTeam=winner;
  }
  if(submission || approval) {
    if(!['home','away','referee'].every(k=>(/^data:image\/png;base64,iVBORw0KGgo/.test(m.signatures?.[k]||'') && m.signatures[k].length<=200000))) {
      if(!m.signatureException?.trim())fail('Cần đủ ba chữ ký hoặc BTC xác nhận ngoại lệ có lý do.');
    }
    if(approval && m.signatureHash && m.signatureHash!==reportHash(m) && !m.signatureException?.trim())fail('Nội dung đã thay đổi sau khi ký. Cần ký lại hoặc BTC ghi lý do ngoại lệ.');
  }
  return m;
}
function validateSources(state) {
  const seen=new Set();
  for(const m of Object.values(state.matches)) {
    if(isKnockout(m))for(const team of [m.home,m.away]){const round=m.round?.replace(/\s+\d+$/,'') || 'Knockout';const key=`${round}@@${team}`;if(seen.has(key))fail('Một đội xuất hiện hai lần trong cùng vòng knockout.');seen.add(key);}
    for(const source of [m.sourceHome,m.sourceAway].filter(Boolean)) {
      if(source.matchId){if(!state.matches[source.matchId]||source.matchId===m.id||!['winner','loser'].includes(source.outcome))fail('Nguồn nhánh đấu không hợp lệ.');}
      else if(source.groupName){const group=state.groupsData.find(g=>g.groupName===source.groupName);if(!group||!Number.isInteger(source.rank)||source.rank<0||source.rank>=group.teams.length)fail('Suất vòng bảng không hợp lệ.');}
      else fail('Nguồn nhánh đấu không hợp lệ.');
    }
    const visit=(id,path)=>{if(path.has(id))fail('Nhánh đấu có vòng phụ thuộc.');const next=new Set(path);next.add(id);const parent=state.matches[id];for(const source of [parent?.sourceHome,parent?.sourceAway])if(source?.matchId)visit(source.matchId,next);};visit(m.id,new Set());
  }
}
function validateSchedule(state) {
  const matches=Object.values(state.matches), minRest=Number(state.tourConfig.minRestMinutes ?? 60)*60000;
  for(let i=0;i<matches.length;i++)for(let j=i+1;j<matches.length;j++) {
    const a=matches[i],b=matches[j];if(!a.date||!b.date)continue;
    const gap=Math.abs(Date.parse(a.date)-Date.parse(b.date)),duration=(Number(state.tourConfig.halfDuration)*2+10+([a,b].some(isKnockout)?Number(state.tourConfig.extraTimeMinutes||0)*2:0))*60000;
    if(a.venue&&a.venue===b.venue&&gap<duration)fail(`Trùng sân: ${a.home}–${a.away} và ${b.home}–${b.away}.`);
    if([a.home,a.away].some(t=>[b.home,b.away].includes(t))&&gap<duration+minRest)fail('Một đội có hai trận quá gần nhau; kiểm tra thời gian nghỉ.');
  }
}
function putPath(state,path,value) {
  const parts=path.replace(/^\/+|\/+$/g,'').split('/');if(parts.some(p=>!safeKey(p)))fail('Đường dẫn dữ liệu không hợp lệ.');
  let target=state;for(const part of parts.slice(0,-1))target=target[part] ||= {};
  if(value===null)delete target[parts.at(-1)];else target[parts.at(-1)]=structuredClone(value);
}
function backup(state,reason) {
  const id=randomUUID(), snapshot=exportBackup(state);state.backups[id]={id,at:new Date().toISOString(),reason,snapshot};
  const keys=Object.keys(state.backups);while(keys.length>5)delete state.backups[keys.shift()];
}
export function exportBackup(state) { const {accounts,receipts,backups,...data}=state;void accounts;void receipts;void backups;return {...structuredClone(data),schemaVersion:2}; }
export function validateBackup(data, accounts = {}) {
  if(!data||Array.isArray(data)||data.schemaVersion!==2)fail('Backup không đúng schemaVersion 2.');
  if(!Array.isArray(data.groupsData)||!data.matches||Array.isArray(data.matches)||!data.players||Array.isArray(data.players))fail('Backup thiếu bảng, trận hoặc cầu thủ.');
  const restored=initialState(data);restored.accounts=structuredClone(accounts);
  for(const [team,list] of Object.entries(restored.players))restored.players[team]=validatePlayers(list,team,list);
  validateGroups(restored.groupsData);
  for(const [id,m] of Object.entries(restored.matches)){if(id!==m.id)fail('Mã trận backup không khớp.');validateMatch(m,restored,{approval:m.status==='Đã xong'});}
  validateSources(restored);validateSchedule(restored);return restored;
}
function validateGroups(groups) {
  if(!Array.isArray(groups)||groups.length>26)fail('Danh sách bảng không hợp lệ.');
  const seen=new Set(), names=new Set();
  for(const g of groups){if(!safeKey(g.groupName)||names.has(g.groupName)||!Array.isArray(g.teams))fail('Bảng trùng hoặc không hợp lệ.');names.add(g.groupName);for(const t of g.teams){if(!safeKey(t))fail('Tên đội không được chứa . # $ [ ] /.');const n=t.trim().normalize('NFC').toLocaleLowerCase('vi');if(seen.has(n))fail('Đội trùng tên.');seen.add(n);}}
}
export function applyCommand(original,cmd,user) {
  if(!user||!['admin','referee'].includes(user.role))fail('Yêu cầu đăng nhập.',401);
  if(!cmd.id || !safeKey(cmd.id))fail('Thiếu mã thao tác.');
  const receiptKey=`${user.username}_${cmd.id}`;
  if(original.receipts?.[receiptKey])return original;
  const state=initialState(original), changed=new Set(), now=new Date().toISOString();
  if(cmd.kind==='reset') {
    if(user.role!=='admin')fail('Chỉ BTC được reset giải.',403);
    if(cmd.expectedVersion!==state._version)fail('Dữ liệu đã thay đổi.',409);
    if(cmd.confirmation!==state.tourConfig.name)fail('Nhập đúng tên giải để xác nhận reset.');
    backup(state,'Trước reset mùa giải');
    if(Object.keys(state.matches).length){const id=randomUUID();state.seasons[id]={id,name:state.tourConfig.name,at:now,data:publicState(state)};}
    const empty=initialState();for(const root of ['tourStatus','tourConfig','groupsData','matches','players','suspensions','handledViolations'])state[root]=empty[root];
  } else if(cmd.kind==='restore') {
    if(user.role!=='admin')fail('Chỉ BTC được phục hồi.',403);
    if(cmd.expectedVersion!==state._version)fail('Database đã thay đổi. Xem lại trước khi phục hồi.',409);
    const restored=validateBackup(cmd.data, state.accounts);backup(state,'Trước phục hồi');
    for(const root of ['tourStatus','tourConfig','groupsData','matches','players','suspensions','handledViolations','seasons'])state[root]=restored[root];
  } else if(cmd.kind==='reopen') {
    const m=state.matches[cmd.matchId];if(user.role!=='admin')fail('Chỉ BTC được mở lại.',403);
    if(!m||m.status!=='Đã xong')fail('Chỉ mở lại trận đã duyệt.');
    if(cmd.version!==(m.version || 0))fail('Biên bản đã thay đổi.',409);
    if(!cmd.reason?.trim())fail('Nhập lý do mở lại.');
    const dependentIds=new Set();
    if(!isKnockout(m))Object.values(state.matches).filter(isKnockout).forEach(x=>dependentIds.add(x.id));
    let frontier=[m.id];while(frontier.length){const parent=frontier.shift();for(const x of Object.values(state.matches))if(!dependentIds.has(x.id)&&(x.sourceHome?.matchId===parent || x.sourceAway?.matchId===parent)){dependentIds.add(x.id);frontier.push(x.id);}}
    // Legacy brackets without explicit sources are conservatively included by team.
    for(const x of Object.values(state.matches))if(isKnockout(x)&&x.id!==m.id&&m.advancingTeam&&[x.home,x.away].includes(m.advancingTeam)&&new Date(x.date||now)>=new Date(m.date||0))dependentIds.add(x.id);
    const dependents=Object.values(state.matches).filter(x=>dependentIds.has(x.id));
    if(dependents.some(x=>x.status!=='Sắp diễn ra'))fail('Trận phụ thuộc đã bắt đầu. Cần BTC xử lý nhánh đấu trước khi mở lại.',409);
    m.revisions ||= [];m.revisions.push({at:now,by:user.username,reason:cmd.reason,match:structuredClone({...m,revisions:undefined})});
    m.signatures=null;m.signatureHash=null;m.signatureException='';m.status='Bị từ chối';m.rejectReason=`Mở lại: ${cmd.reason}`;m.reopenReason=cmd.reason;m.reopenedFromWinner=m.advancingTeam;m.advancingTeam='';m.version=(m.version||0)+1;
    // Lock descendants until this result is approved again, even before a changed winner is known.
    for(const x of dependents){x.sourcePending=true;x.version=(x.version||0)+1;x.lastCommand=cmd.id;}
    changed.add(m.id);
  } else if(cmd.kind==='events') {
    const m=state.matches[cmd.matchId];if(!m)fail('Không tìm thấy trận.',404);
    if(!canOperate(m,user))fail('Bạn không được phân công trận này.',403);
    if(state.tourStatus==='completed')fail('Giải đã khép lại; BTC cần mở lại mùa giải.');
    if(!['Đang LIVE','Bị từ chối'].includes(m.status))fail('Trận không cho phép sửa sự kiện.');
    if(cmd.baseVersion>(m.version || 0))fail('Phiên bản không hợp lệ.',409);
    const events=new Map((m.events||[]).map(e=>[String(e.id),e]));
    for(const id of cmd.remove || []){const existing=events.get(String(id));if(existing)events.set(String(id),{...existing,cancelled:true,cancelReason:cmd.reason || 'Thư ký sửa sự kiện'});}
    for(const e of cmd.add || []){if(events.has(String(e.id))&&JSON.stringify(events.get(String(e.id)))!==JSON.stringify(e))fail('Mã sự kiện đã tồn tại với nội dung khác.',409);events.set(String(e.id),e);}
    m.events=[...events.values()];validateMatch(m,state);m.version=(m.version||0)+1;changed.add(m.id);
  } else if(cmd.kind==='patch') {
    if(!cmd.patches||typeof cmd.patches!=='object'||Array.isArray(cmd.patches))fail('Thao tác không hợp lệ.');
    const entries=Object.entries(cmd.patches);if(!entries.length)fail('Không có thay đổi.');
    if(entries.some(([p])=>!p.startsWith('matches/')) && cmd.expectedVersion!==state._version)fail('Dữ liệu đã thay đổi. Tải lại trước khi lưu.',409);
    for(const [path,value] of entries) {
      const [root,id,...tail]=path.split('/');
      if(!['tourStatus','tourConfig','groupsData','matches','players','suspensions','handledViolations'].includes(root))fail('Không được ghi nhánh dữ liệu này.',403);
      if(root==='matches'&&id) {
        const old=original.matches?.[id];
        if (user.role !== 'admin' && (state.tourStatus === 'completed' || old?.status === 'Chờ duyệt')) fail('Trận đã nộp hoặc giải đã khép lại.',403);
        if(user.role!=='admin' && (!old || !canOperate(old,user)))fail('Bạn không được phân công trận này.',403);
        const predecessor=cmd.predecessors?.[id];
        const followsOwn=predecessor && old?.lastCommand===predecessor && original.receipts?.[`${user.username}_${predecessor}`];
        if(old && cmd.versions?.[id] !== (old.version||0) && !followsOwn)fail('Trận đã thay đổi trên thiết bị khác. Tải lại biên bản.',409);
        if(old?.status==='Đã xong')fail('Phải mở lại trận đã duyệt trước khi sửa.',409);
        if(old?.sourcePending)fail('Trận đang chờ duyệt lại kết quả vòng trước.',409);
        const allowedStaff=['date','ref','sec','status','lineupA','lineupB','clock','shootout','signatures','secretaryNote','rejectReason'];
        const patch=tail.length ? {[tail[0]]:value} : value;
        const adminFields = ['date','venue','ref','sec','assignedSecretary','status','lineupA','lineupB','clock','shootout','signatures','secretaryNote','rejectReason','events','scoreA','scoreB','penA','penB','advancingTeam','resultType','administrativeReason','signatureException'];
        if (old && patch && Object.keys(patch).some(k => !adminFields.includes(k))) fail('Không được sửa trường kiểm toán hoặc cấu trúc trận.',403);
        if(user.role!=='admin' && (!patch || Object.keys(patch).some(k=>!allowedStaff.includes(k))))fail('Thư ký không được sửa trường này.',403);
        changed.add(id);putPath(state,path,value);
      } else {
        if(user.role!=='admin')fail('Chỉ BTC được thay đổi dữ liệu giải.',403);
        if(root==='matches' && Object.values(original.matches||{}).some(m=>m.status!=='Sắp diễn ra'))fail('Không ghi đè lịch đã có trận tác nghiệp.');
        if(['groupsData','tourConfig'].includes(root) && Object.values(original.matches||{}).some(m=>m.status!=='Sắp diễn ra') && root==='groupsData')fail('Không thay bảng sau khi tác nghiệp.');
        if(root==='matches'){backup(state,'Trước thay lịch');Object.keys(value||{}).forEach(id=>changed.add(id));}
        putPath(state,path,value);
      }
    }
    if(!['none','config','setup_teams','draft','active','completed'].includes(state.tourStatus))fail('Trạng thái giải không hợp lệ.');
    const config=state.tourConfig;
    for(const [field,min,max] of [['halfDuration',1,90],['numGroups',1,26],['yellowThreshold',2,10],['shootoutRounds',1,10],['directRedBan',1,20],['secondYellowBan',1,20],['minRestMinutes',0,1440],['extraTimeMinutes',0,30]])if(config[field]!==undefined && (!Number.isInteger(Number(config[field]))||Number(config[field])<min||Number(config[field])>max))fail(`Cấu hình ${field} ngoài phạm vi.`);
    validateGroups(state.groupsData);
    if(!['group','league'].includes(config.format)||!['quarter','semi'].includes(config.knockoutFormat))fail('Thể thức không hợp lệ.');
    if(config.format==='group'&&![1,2,4].includes(Number(config.numGroups)))fail('Knockout từ vòng bảng hỗ trợ 1, 2 hoặc 4 bảng.');
    if(state.tourStatus==='completed' && Object.values(state.matches).some(m=>m.status!=='Đã xong'))fail('Cần duyệt toàn bộ trận trước khi khép lại giải.');
    if(Object.keys(cmd.patches).some(p=>p.startsWith('tourConfig')) && Object.values(original.matches||{}).some(m=>m.status!=='Sắp diễn ra') && ['halfDuration','format','numGroups','knockoutFormat','yellowThreshold','resetYellowsAtKnockout','shootoutRounds','extraTimeMinutes'].some(k=>JSON.stringify(state.tourConfig[k])!==JSON.stringify(original.tourConfig[k])))fail('Không đổi điều lệ sau khi giải đã tác nghiệp.');
    for(const [team,list] of Object.entries(state.players))state.players[team]=validatePlayers(list,team,original.players?.[team]||[]);
    for(const [team,oldList] of Object.entries(original.players||{})) for(const p of oldList){const current=(state.players[team]||[]).find(x=>x.id===p.id);const referenced=Object.values(original.matches||{}).some(m=>m.status!=='Sắp diễn ra'&&((m.events||[]).some(e=>e.team===team&&e.playerId===p.id)||[...(m.lineupA||[]),...(m.lineupB||[])].some(x=>x.id===p.id)));if(referenced&&!current)fail('Cầu thủ đã có biên bản: giữ mã cầu thủ để bảo toàn lịch sử.');}
    for(const id of changed) {
      const m=state.matches[id], old=original.matches?.[id];if(!m){if(old?.status!=='Sắp diễn ra')fail('Không xóa trận đã tác nghiệp.');continue;}
      if(m.id!==id)fail('Mã trận không khớp.');
      const transitions={'Sắp diễn ra':['Sắp diễn ra','Đang LIVE'], 'Đang LIVE':['Đang LIVE','Chờ duyệt'], 'Chờ duyệt':['Chờ duyệt','Đã xong','Bị từ chối'], 'Bị từ chối':['Bị từ chối','Đang LIVE','Chờ duyệt','Đã xong']};
      if(!transitions[old?.status || 'Sắp diễn ra']?.includes(m.status))fail('Chuyển trạng thái trận không hợp lệ.');
      if(user.role!=='admin' && ['Đã xong','Bị từ chối'].includes(m.status)&&m.status!==old?.status)fail('Chỉ BTC được duyệt hoặc trả biên bản.',403);
      if(old && (m.home!==old.home||m.away!==old.away) && old.status!=='Sắp diễn ra')fail('Không thay đội của trận đã bắt đầu.');
      if(m.status==='Đang LIVE') {
        for(const [side,team] of [['lineupA',m.home],['lineupB',m.away]]) {
          if(!(m[side]||[]).some(p=>p.played))fail('Mỗi đội cần điểm danh cầu thủ trước khi bắt đầu.');
          for(const p of m[side]||[]){const suspension=state.suspensions[`${team}@@${p.id}`] || state.suspensions[`${team}@@${p.num} - ${p.name}`];if(p.played && suspension?.remainingMatches!==0 && suspension)fail(`${p.name} còn án treo giò.`);}
        }
      }
      const editsClock=Object.entries(cmd.patches).some(([path,value])=>path===`matches/${id}/clock`||path===`matches/${id}`&&value?.clock);
      if(editsClock&&m.clock){
        if(m.clock.running&&m.clock.timeBasis!=='server'){if(!Number.isFinite(cmd.clientNow)||!Number.isFinite(m.clock.startedAt))fail('Thiếu mốc thời gian client để đồng bộ đồng hồ.');const age=Math.max(0,Math.floor((cmd.clientNow-m.clock.startedAt)/1000));m.clock.elapsed+=age;}
        if(m.clock.timeBasis!=='server')m.clock.startedAt=Date.now();m.clock.timeBasis='server';
      }
      if(m.clock && (!Number.isFinite(m.clock.elapsed)||m.clock.elapsed<0||typeof m.clock.running!=='boolean'||![0,1,2,3,4].includes(m.clock.period)||m.clock.running&&!Number.isFinite(m.clock.startedAt)))fail('Đồng hồ không hợp lệ.');
      validateMatch(m,state,{approval:m.status==='Đã xong',submission:m.status==='Chờ duyệt'});
      if(m.status==='Bị từ chối'&&old?.status==='Chờ duyệt'){m.signatures=null;m.signatureHash=null;m.signatureException='';}
      if(m.status==='Chờ duyệt'&&old?.status!=='Chờ duyệt'){m.signatureHash=reportHash(m);m.submittedAt=now;}
      if(m.status==='Đã xong') {
        m.approvedAt=now;m.approvedBy=user.username;
        for(const dependent of Object.values(state.matches)) {
          for(const [field,source] of [['home','sourceHome'],['away','sourceAway']])if(dependent[source]?.matchId===id){dependent[field]=dependent[source].outcome==='loser'?(m.home===m.advancingTeam?m.away:m.home):m.advancingTeam;dependent.sourcePending=[dependent.sourceHome,dependent.sourceAway].some(src=>src?.matchId&&state.matches[src.matchId]?.status!=='Đã xong');dependent.version=(dependent.version||0)+1;dependent.lastCommand=cmd.id;dependent.lineupA=[];dependent.lineupB=[];}
          if(!isKnockout(m) && dependent.sourcePending) {
            const groupComplete=Object.values(state.matches).filter(x=>!isKnockout(x)).every(x=>x.status==='Đã xong');
            if(groupComplete){for(const [field,source] of [['home','sourceHome'],['away','sourceAway']])if(dependent[source]?.groupName){const g=state.groupsData.find(g=>g.groupName===dependent[source].groupName);const rows=calculateGroupStandings(g.teams,Object.values(state.matches).filter(x=>x.group===g.groupName));dependent[field]=rows[dependent[source].rank]?.name;}dependent.sourcePending=false;dependent.version=(dependent.version||0)+1;dependent.lastCommand=cmd.id;dependent.lineupA=[];dependent.lineupB=[];}
          }
        }
        for(const [key,ban] of Object.entries(state.suspensions))if(ban.matchId!==id && ban.remainingMatches>0 && [m.home,m.away].includes(ban.team) && !ban.servedMatchIds?.includes(id)) {
          if(m.resultType==='forfeit')continue;
          const source=state.matches[ban.matchId];if(source?.date&&m.date&&Date.parse(m.date)<=Date.parse(source.date))continue;
          const lineup=ban.team===m.home?m.lineupA:m.lineupB;
          if((lineup||[]).some(p=>p.played&&key===`${ban.team}@@${p.id}`)){ban.eligibilityConflicts=[...new Set([...(ban.eligibilityConflicts||[]),id])];continue;}
          ban.remainingMatches--;ban.servedMatchIds=[...(ban.servedMatchIds||[]),id];if(!ban.remainingMatches)ban.servedAt=now;
          state.suspensions[key]=ban;
        }
      }
      m.version=(old?.version || 0)+1;
    }
    for(const [key,ban] of Object.entries(state.suspensions)) { if(!ban || !Number.isInteger(ban.remainingMatches) || ban.remainingMatches < 0 || ban.remainingMatches > 20 || !ban.reason || !ban.team) fail('Án phạt cần đội, lý do và số trận còn lại 0–20.'); if(ban.remainingMatches > 0 && !(state.players[ban.team]||[]).some(p=>key===`${ban.team}@@${p.id}`))fail('Án phạt không gắn cầu thủ hợp lệ.'); }
    validateSources(state);validateSchedule(state);
  } else fail('Loại thao tác không hợp lệ.');
  // Decisions survive resets/edits, but a changed source event is flagged for review.
  const violationIds=new Set(detectViolations(Object.values(state.matches),{},state.tourConfig).map(v=>v.key));
  for(const ban of Object.values(state.suspensions))if(ban.violationKey)ban.needsReview=!violationIds.has(ban.violationKey)||!!ban.eligibilityConflicts?.length;
  for(const id of changed)if(state.matches[id])state.matches[id].lastCommand=cmd.id;
  state._version=(original._version||0)+1;state.receipts[receiptKey]={at:now};
  const receipts=Object.keys(state.receipts);while(receipts.length>5000)delete state.receipts[receipts.shift()];
  state.audit=[...(original.audit||[]),{id:cmd.id,at:now,by:user.username,role:user.role,kind:cmd.kind,paths:Object.keys(cmd.patches||{}),matchIds:[...changed],reason:cmd.reason || Object.values(cmd.patches||{}).find(v=>v&&typeof v==='object'&&(v.reason||v.pardonReason))?.reason || Object.values(cmd.patches||{}).find(v=>v&&typeof v==='object'&&v.pardonReason)?.pardonReason || ''}].slice(-1000);
  return state;
}
