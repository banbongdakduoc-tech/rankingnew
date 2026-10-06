import { disciplineMatchSource, formatDateTime } from '../services/tournamentService';
export default function DisciplineMatchSource({matches,record,onView}) {
  const source=disciplineMatchSource(matches,record);
  return <div className="discipline-match-source text-dim" style={{fontSize:'12px',lineHeight:1.6,marginTop:4}}>
    <b>Trận nguồn{source.number?` #${source.number}`:''}: {source.name}</b>
    <div>{[source.round,source.date?formatDateTime(source.date):'',source.minute?`Thẻ phút ${source.minute}`:''].filter(Boolean).join(' · ')}</div>
    {!source.match&&source.id&&<div>Mã trận: {source.id}</div>}
    {source.match&&onView&&<button className="btn ghost tiny" onClick={()=>onView(source.match)}>Xem biên bản trận nguồn</button>}
  </div>;
}
