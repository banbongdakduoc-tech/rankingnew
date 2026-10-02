import { useEffect, useState } from 'react';
import { subscribeSync, flushQueue, discardConflict, exportLocalQueue } from '../services/dataService';

export default function SyncStatus({staff=false}) {
  const [sync,setSync]=useState({loading:true,pending:0,conflicts:[]});
  useEffect(()=>subscribeSync(setSync),[]);
  const exportDraft=async()=>{const blob=new Blob([JSON.stringify(await exportLocalQueue(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='dpl-nhap-chua-dong-bo.json';a.click();URL.revokeObjectURL(url);};
  return <div className={`sync-status ${sync.connected?'connected':'offline'}`} role="status" aria-live="polite">
    <span className="sync-dot"/><b>{sync.loading?'Đang tải dữ liệu…':sync.connected?'Đã kết nối máy chủ':'Mất kết nối máy chủ'}</b>
    {staff&&sync.pending>0&&<span>· {sync.pending} thao tác đã lưu trên máy, chờ gửi</span>}
    {sync.error&&<span className="text-gold">{sync.error}</span>}
    {staff&&sync.pending>0&&sync.connected&&!sync.loading&&<button className="btn ghost tiny" onClick={()=>flushQueue().catch(()=>{})}>Gửi lại nháp</button>}
    {staff&&sync.conflicts?.length>0&&<details><summary className="text-red">{sync.conflicts.length} thao tác cần đối chiếu</summary><p>Dữ liệu nháp được giữ lại. Xuất bản nháp trước khi bỏ thao tác và sửa theo biên bản mới nhất.</p><button className="btn ghost tiny" onClick={exportDraft}>Xuất nháp</button>{sync.conflicts.map(c=><div key={c.id} className="sync-conflict"><span>{c.conflict}</span><button className="btn danger tiny" onClick={()=>{if(window.confirm('Bỏ thao tác này khỏi hàng đợi? Hãy xuất nháp trước nếu cần đối chiếu.'))discardConflict(c.id);}}>Bỏ thao tác chờ</button></div>)}</details>}
  </div>;
}
