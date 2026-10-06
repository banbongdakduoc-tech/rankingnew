import { useEffect, useState } from 'react';
import { subscribeSync, flushQueue, discardConflict, exportLocalQueue } from '../services/dataService';

export default function SyncStatus({staff=false}) {
  const [sync,setSync]=useState({loading:true,pending:0,conflicts:[]});
  useEffect(()=>subscribeSync(setSync),[]);
  const exportDraft=async()=>{const blob=new Blob([JSON.stringify(await exportLocalQueue(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='dpl-nhap-chua-dong-bo.json';a.click();URL.revokeObjectURL(url);};
  const connection=sync.loading?'loading':!sync.connected?'offline':sync.pending||sync.conflicts?.length||sync.error?'waiting':'connected';
  const label=sync.loading?'Đang kết nối':!sync.connected?'Mất kết nối máy chủ':connection==='waiting'?'Có dữ liệu chờ đồng bộ':'Đã kết nối máy chủ';
  return <div className={`sync-status ${connection}`}>
    <span className="sr-only" role="status" aria-live="polite">{label}</span>
    <details className="sync-details">
      <summary title={label} aria-label={label}><span className="sync-dot"/></summary>
      <div className="sync-info"><b>{label}</b>
        {staff&&sync.pending>0&&<p>{sync.pending} thao tác đã lưu trên máy, chờ gửi</p>}
        {staff&&sync.rejections?.length>0&&<div><p className="text-gold">{sync.rejections.length} thao tác nhập sai đã bị từ chối, không chặn nộp biên bản. Bản nháp vẫn được giữ để đối chiếu.</p><button className="btn ghost tiny" onClick={exportDraft}>Xuất nháp đối chiếu</button></div>}
        {sync.error&&<p className="text-gold">{sync.error}</p>}
        {staff&&sync.pending>0&&sync.connected&&!sync.loading&&<button className="btn ghost tiny" onClick={()=>flushQueue().catch(()=>{})}>Gửi lại nháp</button>}
        {staff&&sync.conflicts?.length>0&&<div><p className="text-red">{sync.conflicts.length} thao tác cần đối chiếu</p><p>Dữ liệu nháp được giữ lại. Xuất bản nháp trước khi bỏ thao tác và sửa theo biên bản mới nhất.</p><button className="btn ghost tiny" onClick={exportDraft}>Xuất nháp</button>{sync.conflicts.map(c=><div key={c.id} className="sync-conflict"><span>{c.conflict}</span><button className="btn danger tiny" onClick={()=>{if(window.confirm('Bỏ thao tác này khỏi hàng đợi? Hãy xuất nháp trước nếu cần đối chiếu.'))discardConflict(c.id);}}>Bỏ thao tác chờ</button></div>)}</div>}
      </div>
    </details>
  </div>;
}
