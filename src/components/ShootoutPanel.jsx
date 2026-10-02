import { useState } from 'react';
import { evaluateShootout } from '../services/tournamentService';

export default function ShootoutPanel({match,players,rounds=5,onChange}) {
  const [team,setTeam]=useState(match.home),[playerId,setPlayerId]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const kicks=match.shootout || [];
  let result={penA:0,penB:0,winner:''};try{result=evaluateShootout(kicks,match.home,match.away,rounds);}catch(e){result.error=e.message;}
  const roster=(players[team] || []).filter(p=>(match[team===match.home?'lineupA':'lineupB'] || []).some(x=>x.id===p.id&&x.played));
  const change=async(next)=>{setSaving(true);setError('');try{await onChange(next);}catch(e){setError(e.message);}finally{setSaving(false);}};
  return <section className="shootout-panel card mb16" aria-label="Loạt sút luân lưu">
    <div className="flex-between mb12"><h3 className="text-gold">Luân lưu · {rounds} lượt đầu</h3><span className="badge badge-pending">{result.penA} – {result.penB}</span></div>
    <p className="text-dim mb12">Luân lưu không cộng vào tỷ số trong trận hoặc Vua phá lưới. Chọn cầu thủ và ghi từng lượt theo quyết định trọng tài.</p>
    {result.winner&&<p className="text-accent mb12">Đã phân thắng bại: <b>{result.winner}</b></p>}
    {kicks.length>0&&<div className="table-container mb12"><table className="dpl-table"><thead><tr><th>Lượt</th><th>Đội / Cầu thủ</th><th>Kết quả</th></tr></thead><tbody>{kicks.map((k,i)=><tr key={k.id}><td>{i+1}</td><td>{k.team} · {k.player}</td><td>{k.result==='scored'?'✓ Vào':'✕ Trượt'}</td></tr>)}</tbody></table></div>}
    <div className="grid-2 mb12"><label className="form-label">Đội sút<select className="select-dark" value={team} onChange={e=>{setTeam(e.target.value);setPlayerId('');}}><option>{match.home}</option><option>{match.away}</option></select></label><label className="form-label">Cầu thủ<select className="select-dark" value={playerId} onChange={e=>setPlayerId(e.target.value)}><option value="">Chọn cầu thủ</option>{roster.map(p=><option key={p.id} value={p.id}>#{p.num} · {p.name}</option>)}</select></label></div>
    <div className="flex-gap"><button className="btn green" disabled={saving||!playerId||!!result.winner} onClick={()=>{const p=roster.find(p=>p.id===playerId);change([...kicks,{id:crypto.randomUUID(),team,playerId,player:`${p.num} - ${p.name}`,result:'scored',sequence:Date.now()}]);}}>✓ Vào</button><button className="btn danger" disabled={saving||!playerId||!!result.winner} onClick={()=>{const p=roster.find(p=>p.id===playerId);change([...kicks,{id:crypto.randomUUID(),team,playerId,player:`${p.num} - ${p.name}`,result:'missed',sequence:Date.now()}]);}}>✕ Trượt</button>{kicks.length>0&&<button className="btn ghost" disabled={saving} onClick={()=>{if(window.confirm('Hủy lượt cuối để sửa sai/đá lại? Thao tác sẽ được ghi nhật ký.'))change(kicks.slice(0,-1));}}>Hủy lượt cuối / Đá lại</button>}</div>
    {(error||result.error)&&<p className="text-red mt12" role="alert">{error||result.error}</p>}
  </section>;
}
