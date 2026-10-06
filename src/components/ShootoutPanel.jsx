import { useState } from 'react';
import { evaluateShootout, shootoutUsedPlayers, shootoutRows, shootoutRestrictions, validateShootoutDraft } from '../services/tournamentService';

// Event-only factory: create identifiers/timestamps when a user records a kick.
function newKick(team,player,outcome) {
  return {id:crypto.randomUUID(),team,playerId:player.id,player:`${player.num} - ${player.name}`,result:outcome,sequence:Date.now()};
}
export default function ShootoutPanel({match,players,suspensions={},rounds=5,extraTimeMinutes=0,onChange}) {
  const [team,setTeam]=useState(match.home),[playerId,setPlayerId]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const kicks=match.shootout || [];
  let result={penA:0,penB:0,winner:''};try{result=evaluateShootout(kicks,match.home,match.away,rounds);}catch(e){result.error=e.message;}
  const blocked=shootoutRestrictions(match,players,suspensions);
  const allRoster=players[team] || [];
  const roster=allRoster.filter(p=>!blocked.has(`${team}@@${p.id}`));
  const rows=shootoutRows(match,rounds);
  const used=shootoutUsedPlayers(kicks,team,roster.map(p=>p.id));
  const change=async(next)=>{setError('');try{validateShootoutDraft(match,next,players,suspensions,rounds,extraTimeMinutes);setSaving(true);await onChange(next);}catch(e){setError(e.message);}finally{setSaving(false);}};
  const wrongTurn=result.attemptsA>result.attemptsB?team!==match.away:result.attemptsB>result.attemptsA?team!==match.home:false;
  const needsExtraTime=extraTimeMinutes>0&&match.clock?.period!==4;
  const recordKick = outcome => {
    const p=roster.find(p=>p.id===playerId);
    if(!p||used.has(playerId)||saving||result.winner||wrongTurn||needsExtraTime||result.error)return;
    change([...kicks,newKick(team,p,outcome)]);
  };
  return <section className="shootout-panel card mb16" aria-label="Loạt sút luân lưu">
    <div className="flex-between mb12"><h3 className="text-gold">Luân lưu · {rounds} lượt đầu</h3><span className="badge badge-pending">{result.penA} – {result.penB}</span></div>
    <p className="text-dim mb12">Luân lưu không cộng vào tỷ số trong trận hoặc Vua phá lưới. Chọn cầu thủ và ghi từng lượt theo quyết định trọng tài.</p>
    {result.winner&&<p className="text-accent mb12">Đã phân thắng bại: <b>{result.winner}</b></p>}
    <div className="shootout-team-table mb12">
      <table aria-label="Luân lưu theo đội"><thead><tr><th scope="col">Lượt</th><th scope="col">{match.home}<span className="text-gold">{result.penA} bàn</span></th><th scope="col">{match.away}<span className="text-gold">{result.penB} bàn</span></th></tr></thead>
      <tbody>{rows.map(row=><tr key={row.attempt}><th scope="row">{row.attempt}{row.attempt>rounds&&<small>Đột tử</small>}</th>{[row.home,row.away].map((kick,i)=><td key={i}>{kick?<><span className="shootout-player">{kick.player}</span><span className={kick.result==='scored'?'text-accent':'text-red'}>{kick.result==='scored'?'✓ Vào':'✕ Trượt'}</span></>:<span className="text-dim">—</span>}</td>)}</tr>)}</tbody></table>
    </div>
    {[match.home,match.away].map(t=>{const excluded=(players[t] || []).filter(p=>blocked.has(`${t}@@${p.id}`));return excluded.length>0&&<div key={t} className="qa-checklist mb12"><b className="text-red">{t} · Không được sút luân lưu</b>{excluded.map(p=><p key={p.id}>#{p.num} · {p.name} — <span className="text-red">{blocked.get(`${t}@@${p.id}`)}</span></p>)}</div>;})}
    <div className="grid-2 mb12"><label className="form-label">Đội sút<select className="select-dark" value={team} onChange={e=>{setTeam(e.target.value);setPlayerId('');}}><option>{match.home}</option><option>{match.away}</option></select></label><label className="form-label">Cầu thủ<select className="select-dark" value={playerId} onChange={e=>setPlayerId(e.target.value)}><option value="">Chọn cầu thủ</option>{allRoster.map(p=><option key={p.id} value={p.id} disabled={blocked.has(`${team}@@${p.id}`)||used.has(p.id)}>#{p.num} · {p.name}{blocked.has(`${team}@@${p.id}`)?` · ${blocked.get(`${team}@@${p.id}`)} — Không được sút`:used.has(p.id)?' · Đã sút, chờ đủ vòng':''}</option>)}</select></label></div>
    {wrongTurn&&<p className="text-gold mb12">Đến lượt {result.attemptsA>result.attemptsB?match.away:match.home} sút. Chọn đội đúng trước khi ghi lượt.</p>}
    {needsExtraTime&&<p className="text-gold mb12">Hoàn thành hai hiệp phụ trước khi ghi luân lưu.</p>}
    <div className="flex-gap"><button className="btn green" disabled={saving||wrongTurn||needsExtraTime||!!result.error||used.has(playerId)||!roster.some(p=>p.id===playerId)||!!result.winner} onClick={()=>recordKick('scored')}>✓ Vào</button><button className="btn danger" disabled={saving||wrongTurn||needsExtraTime||!!result.error||used.has(playerId)||!roster.some(p=>p.id===playerId)||!!result.winner} onClick={()=>recordKick('missed')}>✕ Trượt</button>{kicks.length>0&&<button className="btn ghost" disabled={saving} onClick={()=>{if(window.confirm('Hủy lượt cuối để sửa sai/đá lại? Thao tác sẽ được ghi nhật ký.'))change(kicks.slice(0,-1));}}>Hủy lượt cuối / Đá lại</button>}</div>
    {(error||result.error)&&<p className="text-red mt12" role="alert">{error||result.error}</p>}
  </section>;
}
