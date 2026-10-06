export const DEFAULT_RULES = { yellowThreshold: 2, resetYellowsAtKnockout: true, directRedBan: 1, secondYellowBan: 1, shootoutRounds: 5, extraTimeMinutes: 0, reapplyH2H: true };
export const isKnockout = (m) => m.group === 'Vòng Knock-out';
export const playerKey = (team, player, id) => `${team}@@${id || player}`;
const official = (m) => m.status === 'Đã xong';
const goals = (e) => e.type === 'goal' && ['normal', 'pen', 'penalty'].includes(e.detail || 'normal');
const yellow = (e) => ['Vàng', 'yellow'].includes(e.detail);
const directRed = (e) => ['Đỏ', 'red', 'direct_red'].includes(e.detail);
const secondYellow = (e) => e.detail === 'second_yellow_red';
const numeric = (v) => Number(v) || 0;

export function calculateEventsGoals(events = [], home = '', away = '') {
  let goalsA = 0, goalsB = 0;
  for (const e of events) {
    if (e.cancelled || e.phase === 'shootout') continue;
    if (goals(e)) { if (e.team === home) goalsA++; else if (e.team === away) goalsB++; }
    if (e.type === 'goal' && e.detail === 'own') { if (e.team === home) goalsB++; else if (e.team === away) goalsA++; }
  }
  return { goalsA, goalsB };
}

export function calculateGroupStandings(teams = [], matches = [], options = {}) {
  const eligible = matches.filter(m => official(m) || (options.provisional && ['Đang LIVE', 'Chờ duyệt'].includes(m.status)));
  function table(names, games) {
    return names.map(name => {
      const t = { name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [] };
      for (const m of games.filter(m => m.home === name || m.away === name).sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.id).localeCompare(String(b.id)))) {
        const gf = numeric(m.home === name ? m.scoreA : m.scoreB), ga = numeric(m.home === name ? m.scoreB : m.scoreA);
        t.p++; t.gf += gf; t.ga += ga;
        const result = gf > ga ? 'W' : gf === ga ? 'D' : 'L';
        t[result === 'W' ? 'w' : result === 'D' ? 'd' : 'l']++; t.form.push(result);
      }
      t.gd = t.gf - t.ga; t.pts = t.w * 3 + t.d; t.form = t.form.slice(-5); return t;
    });
  }
  const rows = table(teams, eligible);
  const fallback = (a,b) => b.gd-a.gd || b.gf-a.gf || a.name.localeCompare(b.name,'vi');
  function breakTie(tied) {
    if (tied.length < 2) return tied;
    const names = tied.map(t => t.name);
    const h2h = table(names, eligible.filter(m => names.includes(m.home) && names.includes(m.away)));
    const metrics = new Map(h2h.map(t => [t.name, t]));
    const criteria = ['pts','gd','gf'];
    const compare = (a,b) => { for (const c of criteria) { const d = metrics.get(b.name)[c]-metrics.get(a.name)[c]; if (d) return d; } return 0; };
    const sorted = tied.slice().sort(compare);
    const clusters = [];
    for (const t of sorted) { const last = clusters.at(-1); if (last && compare(last[0],t) === 0) last.push(t); else clusters.push([t]); }
    return clusters.flatMap(cluster => {
      if (cluster.length > 1 && cluster.length < tied.length && options.reapplyH2H !== false) return breakTie(cluster);
      return cluster.sort(fallback).map(t => ({...t, tieBreak: `H2H ${metrics.get(t.name).pts}đ · GD ${metrics.get(t.name).gd} · GF ${metrics.get(t.name).gf}`}));
    });
  }
  const points = [...new Set(rows.map(t => t.pts))].sort((a,b) => b-a);
  return points.flatMap(p => breakTie(rows.filter(t => t.pts === p)));
}

export function isGroupStageFinished(matches = []) {
  const group = matches.filter(m => !isKnockout(m)); return group.length > 0 && group.every(official);
}
export function getQualifyingCount(format = 'quarter', groups = 2) { return Math.floor((format === 'semi' ? 4 : 8) / Math.max(1, groups)); }
export function generateKnockoutPairs(groupsData = [], matches = [], format = 'quarter') {
  const total = format === 'semi' ? 4 : 8, count = groupsData.length;
  if (![1,2,4].includes(count) || total % count) throw new Error('Số bảng không phù hợp nhánh knockout; hỗ trợ 1, 2 hoặc 4 bảng.');
  if (!isGroupStageFinished(matches)) throw new Error('Cần duyệt toàn bộ vòng bảng trước khi sinh knockout.');
  const perGroup = total/count;
  const standings = groupsData.map(g => calculateGroupStandings(g.teams, matches.filter(m => m.group === g.groupName)));
  if (standings.some(s => s.length < perGroup)) throw new Error(`Mỗi bảng cần ít nhất ${perGroup} đội để đủ ${total} suất.`);
  const pairs = [];
  const pair = (a,b) => pairs.push({ home:a, away:b, label:`${format === 'semi' ? 'Bán Kết' : 'Tứ Kết'} ${pairs.length+1}` });
  if (count === 1) {
    const seeds = total === 8 ? [[0,7],[3,4],[1,6],[2,5]] : [[0,3],[1,2]];
    seeds.forEach(([a,b]) => pair(standings[0][a].name,standings[0][b].name));
  } else if (count === 2) {
    const a = standings[0], b = standings[1];
    if (total === 4) { pair(a[0].name,b[1].name); pair(b[0].name,a[1].name); }
    else { pair(a[0].name,b[3].name); pair(b[1].name,a[2].name); pair(b[0].name,a[3].name); pair(a[1].name,b[2].name); }
  } else {
    if (total === 4) { pair(standings[0][0].name,standings[3][0].name); pair(standings[1][0].name,standings[2][0].name); }
    else { pair(standings[0][0].name,standings[1][1].name); pair(standings[2][0].name,standings[3][1].name); pair(standings[1][0].name,standings[0][1].name); pair(standings[3][0].name,standings[2][1].name); }
  }
  return pairs;
}

export function parseMatchMinute(value, period = 1) {
  const match = String(value).trim().match(/^(\d{1,3})(?:\+(\d{1,2}))?'?$/);
  if (!match || +match[1] < 1) throw new Error('Phút không hợp lệ. Ví dụ: 12, 20+3 hoặc 40+2.');
  return { minute:+match[1], addedMinute:+(match[2] || 0), period, displayMinute:`${+match[1]}${match[2] ? `+${+match[2]}` : ''}'` };
}
export function compareEvents(a,b) {
  const parse = e => { try { return parseMatchMinute(e.displayMinute || e.minute, e.period || (numeric(e.minute) > 20 ? 2 : 1)); } catch { return {period:e.period || 1, minute:numeric(e.minute),addedMinute:numeric(e.addedMinute)}; } };
  const x=parse(a), y=parse(b); x.addedMinute=numeric(a.addedMinute) || x.addedMinute; y.addedMinute=numeric(b.addedMinute) || y.addedMinute;
  return Number(a.phase==='shootout')-Number(b.phase==='shootout') || x.period-y.period || x.minute-y.minute || x.addedMinute-y.addedMinute || numeric(a.sequence)-numeric(b.sequence) || String(a.id).localeCompare(String(b.id));
}
export function formatMatchMinute(seconds = 0, halfDuration = 20, period = 1, extraTimeMinutes = 0) {
  const half = halfDuration > 0 ? halfDuration : 20;
  const min = Math.max(1, Math.ceil(Math.max(0,seconds)/60)), end = period===4?half*2+extraTimeMinutes*2:period===3?half*2+extraTimeMinutes:period===2?half*2:half;
  return { minuteNum:min, displayMinute:min > end ? `${end}+${min-end}'` : `${min}'`, period, addedMinute:Math.max(0,min-end) };
}
export function formatSecondsToMMSS(seconds = 0) {
  const n=Math.max(0,Math.floor(seconds));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
}
export function elapsedClock(clock = {}, now = Date.now()) {
  return Math.max(0, numeric(clock.elapsed) + (clock.running && clock.startedAt ? Math.floor(Math.max(0,now-clock.startedAt)/1000) : 0));
}

export function evaluateShootout(kicks = [], home, away, rounds = 5) {
  let a=0,b=0,na=0,nb=0,winner='';
  for (const k of kicks.filter(k => !k.cancelled && k.result !== 'retake')) {
    if (winner) throw new Error('Loạt luân lưu đã kết thúc; cần hủy lượt sai trước khi thêm.');
    if (![home,away].includes(k.team) || !['scored','missed'].includes(k.result)) throw new Error('Lượt luân lưu không hợp lệ.');
    if (k.team === home) { if (na > nb) throw new Error('Hai đội phải sút luân phiên.'); na++; if(k.result==='scored')a++; }
    else { if(nb>na)throw new Error('Hai đội phải sút luân phiên.'); nb++; if(k.result==='scored')b++; }
    if (na <= rounds && nb <= rounds) {
      if (a > b + rounds - nb) winner=home;
      if (b > a + rounds - na) winner=away;
    }
    if (na >= rounds && nb >= rounds && na===nb && a!==b) winner=a>b?home:away;
  }
  return {penA:a, penB:b, winner, attemptsA:na,attemptsB:nb,complete:!!winner};
}
export function resolveWinner(match) {
  if (numeric(match.scoreA) !== numeric(match.scoreB)) return numeric(match.scoreA)>numeric(match.scoreB)?match.home:match.away;
  if (match.shootout?.length) return evaluateShootout(match.shootout,match.home,match.away,match.shootoutRounds || 5).winner;
  // Historical imported matches may only have aggregate penalties; new matches use per-kick records.
  if (match.penA !== '' && match.penB !== '' && match.penA != null && match.penB != null && numeric(match.penA)!==numeric(match.penB)) return numeric(match.penA)>numeric(match.penB)?match.home:match.away;
  return '';
}

export function getTopScorers(matches = [], playersData = {}, options = {}) {
  const stats={};
  for (const m of matches.filter(m => official(m) || options.provisional && ['Đang LIVE','Chờ duyệt'].includes(m.status))) {
    for (const e of m.events || []) {
      if (!goals(e) || e.cancelled || e.phase==='shootout') continue;
      const key=playerKey(e.team,e.player,e.playerId);
      const found=(playersData[e.team] || []).find(p => e.playerId ? p.id===e.playerId : `${p.num} - ${p.name}`===e.player || p.name===e.player);
      stats[key] ||= {key,rawName:e.player,team:e.team,playerId:e.playerId,goals:0,avatar:found?.avatar || ''};stats[key].goals++;
    }
  }
  return Object.values(stats).sort((a,b) => b.goals-a.goals || a.rawName.localeCompare(b.rawName,'vi')).map((s,i) => ({...s,rank:i+1,displayName:(playersData[s.team]||[]).find(p=>p.id===s.playerId)?.name || s.rawName.replace(/^\d+\s*-\s*/, '')}));
}
export function getDisciplineStats(matches = [], options = {}) {
  const stats={};
  for (const m of matches.filter(m => official(m) || options.provisional && ['Đang LIVE','Chờ duyệt'].includes(m.status))) {
    for(const e of m.events || []) {
      if(e.type!=='card' || e.cancelled)continue;
      const key=playerKey(e.team,e.player,e.playerId);
      stats[key] ||= {key,rawName:e.player,team:e.team,playerId:e.playerId,yellow:0,red:0,directRed:0,secondYellow:0,shootoutYellow:0,shootoutRed:0};
      if(yellow(e)||secondYellow(e)){stats[key].yellow++;if(e.phase==='shootout')stats[key].shootoutYellow++;}
      if(directRed(e)){if(e.phase==='shootout')stats[key].shootoutRed++;stats[key].red++;stats[key].directRed++;}
      if(secondYellow(e)){if(e.phase==='shootout')stats[key].shootoutRed++;stats[key].red++;stats[key].secondYellow++;}
    }
  }
  return Object.values(stats).sort((a,b) => (b.red*3+b.yellow)-(a.red*3+a.yellow) || a.rawName.localeCompare(b.rawName,'vi')).map((s,i)=>({...s,rank:i+1,displayName:s.rawName.replace(/^\d+\s*-\s*/, '')}));
}
export function detectViolations(matches = [], handled = {}, config = {}) {
  const rules={...DEFAULT_RULES,...config}, alerts=[], counts={};
  for (const m of matches.filter(official).slice().sort((a,b)=>String(a.date || '').localeCompare(String(b.date || '')) || String(a.id).localeCompare(String(b.id)))) {
    const perMatch={};
    for (const e of (m.events || []).slice().sort(compareEvents)) {
      if(e.type!=='card'||e.cancelled)continue;
      const pKey=playerKey(e.team,e.player,e.playerId);
      const alert=(kind,reason,length) => alerts.push({key:`${pKey}@@${m.id}@@${kind}@@${e.id}`,pKey,team:e.team,player:e.player,playerId:e.playerId,matchId:m.id,eventId:e.id,kind,matchName:`${m.home} vs ${m.away}`,reason,matches:length});
      if(directRed(e))alert('direct_red','Thẻ đỏ trực tiếp',rules.directRedBan);
      if(yellow(e)||secondYellow(e)) {
        const phaseKey=`${pKey}@@${e.phase==='shootout'?'shootout':'play'}`;perMatch[phaseKey]=(perMatch[phaseKey]||0)+1;
        if(perMatch[phaseKey]===2 || secondYellow(e)) { alert('second_yellow','Truất quyền thi đấu do vàng thứ hai',rules.secondYellowBan); }
      }
    }
    // Two yellows in one match belong to dismissal, not the across-match accumulation counter.
    for (const [phaseKey,n] of Object.entries(perMatch)) {
      if(n!==1||phaseKey.endsWith('@@shootout'))continue;
      const key=phaseKey.slice(0,-6);
      const stage=rules.resetYellowsAtKnockout && isKnockout(m)?'ko':'group', counter=`${key}@@${stage}`;
      counts[counter]=(counts[counter]||0)+1;
      if(counts[counter]>=rules.yellowThreshold) {
        const e=(m.events||[]).find(e=>playerKey(e.team,e.player,e.playerId)===key && yellow(e));
        if(e)alerts.push({key:`${key}@@${m.id}@@accumulation@@${e.id}`,pKey:key,playerId:e.playerId,team:e.team,player:e.player,matchId:m.id,eventId:e.id,kind:'accumulation',matchName:`${m.home} vs ${m.away}`,reason:`Tích lũy ${rules.yellowThreshold} thẻ vàng (${stage==='ko'?'Knock-out':'Vòng bảng'})`,matches:1});
        counts[counter]=0;
      }
    }
  }
  return alerts.filter(a => !handled[a.key]);
}

export function generateRoundRobinMatches(groupsData = []) {
  const matches={}, seenTeams=new Set();
  for (const [gi,g] of groupsData.entries()) {
    if(!g.teams || g.teams.length<2)throw new Error('Mỗi bảng cần ít nhất hai đội.');
    for(const team of g.teams){const normalized=team.trim().normalize('NFC').toLocaleLowerCase('vi');if(seenTeams.has(normalized))throw new Error('Đội trùng tên trong giải.');seenTeams.add(normalized);}
    const wheel=[...g.teams];if(wheel.length%2)wheel.push(null);
    for(let r=0;r<wheel.length-1;r++) {
      for(let i=0;i<wheel.length/2;i++) {
        const a=wheel[i],b=wheel[wheel.length-1-i];if(!a||!b)continue;
        const id=`match_${gi}_${r+1}_${i}_${crypto.randomUUID()}`;
        matches[id]={id,group:g.groupName,round:`Vòng ${r+1}`,roundNumber:r+1,home:r%2?b:a,away:r%2?a:b,date:'',venue:'',ref:'',sec:'',status:'Sắp diễn ra',scoreA:0,scoreB:0,penA:'',penB:'',events:[],lineupA:[],lineupB:[],signatures:null,version:0,advancingTeam:''};
      }
      wheel.splice(1,0,wheel.pop());
    }
  }
  return matches;
}
export function validatePlayers(list = [], team = '', existing = []) {
  if(!Array.isArray(list)||list.length>100)throw new Error('Danh sách phải là mảng tối đa 100 cầu thủ.');
  const numbers=new Set(), ids=new Set();
  return list.map((p,i)=>{
    const num=Number(p.num ?? p.soAo), name=String(p.name ?? p.ten ?? '').trim();
    if(!Number.isInteger(num)||num<1||num>99||!name||name.length>100)throw new Error(`Dòng ${i+1}: số áo 1–99 và họ tên hợp lệ là bắt buộc.`);
    if(numbers.has(num))throw new Error(`Dòng ${i+1}: trùng số áo ${num}.`);numbers.add(num);
    if(p.id!==undefined&&(typeof p.id!=='string'||!p.id||p.id.length>160||['.','#','$','[',']','/'].some(c=>p.id.includes(c))||['__proto__','constructor','prototype'].includes(p.id)))throw new Error(`Dòng ${i+1}: mã cầu thủ không hợp lệ.`);
    const id=p.id || existing.find(x=>Number(x.num)===num && x.name===name)?.id || crypto.randomUUID();
    if(ids.has(id))throw new Error(`Dòng ${i+1}: trùng mã cầu thủ.`);ids.add(id);
    const avatar=p.avatar||'';
    if(typeof avatar!=='string' || avatar.length>250000 || avatar && !/^(data:image\/(jpeg|png|webp);base64,|https:\/\/)/.test(avatar))throw new Error(`Dòng ${i+1}: ảnh không hợp lệ hoặc quá lớn.`);
    const previous=existing.find(x=>x.id===id), profileHistory=(previous?.profileHistory || []).map(x=>({num:Number(x.num),name:String(x.name)}));
    if(previous&&(Number(previous.num)!==num||previous.name!==name)&&!profileHistory.some(x=>x.num===Number(previous.num)&&x.name===previous.name))profileHistory.push({num:Number(previous.num),name:previous.name});
    return {id,team,num,name,...(profileHistory.length?{profileHistory}:{}),shirtName:String(p.shirtName ?? p.tenAo ?? name).trim().slice(0,60),avatar};
  });
}

export function mergeMatchDraft(previous,current) {
  const keep=previous?.id===current.id && previous.version===current.version && ['Đang LIVE','Bị từ chối'].includes(current.status);
  return {...current,signatures:keep ? previous.signatures || current.signatures : current.signatures};
}

export function normalizeKickoff(value) {
  if(!value)return '';
  if(typeof value!=='string')throw new Error('Ngày giờ trận không hợp lệ.');
  const input=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)?`${value}+07:00`:value;
  const date=new Date(input);if(!Number.isFinite(date.getTime()))throw new Error('Ngày giờ trận không hợp lệ.');return date.toISOString();
}
export function kickoffInput(value) {
  if(!value)return '';
  try {const date=new Date(normalizeKickoff(value)),parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;}catch{return '';}
}

/** Global fixture numbers: assign before filtering by team, group, status or secretary. */
export function numberMatchesBySchedule(matches) {
  const kickoff = m => {
    try { return m.date ? Date.parse(normalizeKickoff(m.date)) : Infinity; }
    catch { return Infinity; }
  };
  const stage = m => {
    if (m.group !== 'Vòng Knock-out') return 0;
    const round = (m.round || '').toLowerCase();
    if (round.includes('tứ kết')) return 1;
    if (round.includes('bán kết')) return 2;
    if (round.includes('hạng')) return 3;
    if (round.includes('chung kết')) return 4;
    return 1;
  };
  return [...matches].sort((a, b) => {
    const at = kickoff(a), bt = kickoff(b);
    if (at !== bt) return at < bt ? -1 : 1;
    return stage(a) - stage(b) || String(a.id).localeCompare(String(b.id), 'en', { numeric: true });
  }).map((m, index) => ({ ...m, matchNumber: index + 1 }));
}

// Never display a stale saved total when detailed shootout kicks are available.
export function shootoutSummary(match = {}, rounds = match.shootoutRounds || 5) {
  if(!match.shootout?.length)return {penA:match.penA ?? '',penB:match.penB ?? '',winner:''};
  try {return evaluateShootout(match.shootout,match.home,match.away,rounds);}
  catch(e){return {penA:'',penB:'',winner:'',error:e.message};}
}
export function shootoutUsedPlayers(kicks, team, eligibleIds) {
  const eligible=new Set(eligibleIds),used=new Set();
  for(const kick of kicks || []) {
    if(kick.team!==team||kick.cancelled||kick.result==='retake'||!eligible.has(kick.playerId))continue;
    if(used.size===eligible.size)used.clear();
    used.add(kick.playerId);
  }
  if(used.size===eligible.size)used.clear();
  return used;
}

export function shootoutRows(match, rounds = 5) {
  const active=(match.shootout || []).filter(k=>!k.cancelled&&k.result!=='retake');
  const home=active.filter(k=>k.team===match.home),away=active.filter(k=>k.team===match.away);
  return Array.from({length:Math.max(rounds,home.length,away.length)},(_,i)=>({attempt:i+1,home:home[i] || null,away:away[i] || null}));
}

// Same player restrictions for shootout selection and preflight validation.
export function shootoutRestrictions(match, players, suspensions = {}, beforeSequence = Infinity) {
  const blocked = new Map(), yellows = new Map();
  for(const team of [match.home,match.away])for(const p of players[team] || []) {
    const ban=suspensions[`${team}@@${p.id}`];
    if(ban?.remainingMatches>0&&ban.matchId!==match.id)blocked.set(`${team}@@${p.id}`,'Treo giò');
  }
  for(const event of (match.events || []).filter(e=>!e.cancelled&&e.type==='card').slice().sort(compareEvents)) {
    if(event.phase==='shootout'&&event.sequence>beforeSequence)continue;
    const p=(players[event.team] || []).find(p=>event.playerId?p.id===event.playerId:`${p.num} - ${p.name}`===event.player||p.name===event.player);
    if(!p)continue;
    const key=`${event.team}@@${p.id}`;
    if(['red','Đỏ','direct_red'].includes(event.detail))blocked.set(key,'Thẻ đỏ trực tiếp');
    if(['yellow','Vàng','second_yellow_red'].includes(event.detail)) {
      const phaseKey=`${key}@@${event.phase==='shootout'?'shootout':'play'}`;
      const count=(yellows.get(phaseKey)||0)+1;yellows.set(phaseKey,count);
      if(count>=2||event.detail==='second_yellow_red')blocked.set(key,'Thẻ vàng thứ hai');
    }
  }
  return blocked;
}
export function validateShootoutDraft(match, kicks, players, suspensions = {}, rounds = 5, extraTimeMinutes = 0) {
  if(kicks.some(k=>!k.cancelled&&k.result!=='retake')) {
    if(!isKnockout(match)||Number(match.scoreA)!==Number(match.scoreB))throw new Error('Chỉ sút luân lưu khi hòa ở knockout.');
    if(extraTimeMinutes>0&&match.clock?.period!==4)throw new Error('Hoàn thành hai hiệp phụ trước khi sút luân lưu.');
  }
  const ids=new Set(),cycles=new Map();
  for(const kick of kicks) {
    if(kick.cancelled||kick.result==='retake')continue;
    if(!kick.id||ids.has(kick.id))throw new Error('Lượt luân lưu bị trùng.');ids.add(kick.id);
    if(!(players[kick.team] || []).some(p=>p.id===kick.playerId))throw new Error('Người sút luân lưu không hợp lệ.');
    const blocked=shootoutRestrictions(match,players,suspensions,kick.sequence || Infinity);
    const reason=blocked.get(`${kick.team}@@${kick.playerId}`);if(reason)throw new Error(`Không được sút luân lưu: ${reason}.`);
    const eligible=(players[kick.team] || []).filter(p=>!blocked.has(`${kick.team}@@${p.id}`));
    const used=cycles.get(kick.team)||new Set();if(used.size===eligible.length)used.clear();
    if(used.has(kick.playerId))throw new Error('Mọi cầu thủ đủ điều kiện phải sút trước khi một người sút lần nữa.');
    used.add(kick.playerId);cycles.set(kick.team,used);
  }
  return evaluateShootout(kicks,match.home,match.away,rounds);
}
