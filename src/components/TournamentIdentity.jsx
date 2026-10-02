import { useState } from 'react';
import { db, ref, update } from '../services/dataService';
import { chooseAvatarImage } from '../services/avatarService';
import { useToast } from './ToastContext';

export default function TournamentIdentity({tourConfig}) {
  const toast=useToast();
  const [form,setForm]=useState({name:tourConfig.name||'',organizer:tourConfig.organizer||'CLB Thể Thao Trường Dược',logo:tourConfig.logo||''});
  const [busy,setBusy]=useState(false);
  const save=async e=>{e.preventDefault();setBusy(true);try{await update(ref(db,'tourConfig'),{...form,name:form.name.trim(),organizer:form.organizer.trim()});toast.success('Đã lưu thông tin giải.');}catch(err){toast.error(err.message);}finally{setBusy(false);}};
  return <section className="card mb24"><div className="card-header"><h3 className="text-accent">Thông tin giải & đơn vị tổ chức</h3></div>
    <form onSubmit={save} className="grid-2">
      <div><label className="form-label">Tên giải đấu<input className="input-dark" required maxLength={160} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label className="form-label">Đơn vị tổ chức<input className="input-dark" required maxLength={160} value={form.organizer} onChange={e=>setForm({...form,organizer:e.target.value})}/></label></div>
      <div className="identity-logo"><img src={form.logo||'/logo.png'} alt="Logo giải đấu"/><div><label className="btn ghost">Chọn logo<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{const logo=await chooseAvatarImage(file);setForm(f=>({...f,logo}));}catch(err){toast.error(err.message);}}}/></label><p className="text-dim mt12">Ảnh được cắt vuông và nén trước khi lưu.</p>{form.logo&&<button type="button" className="btn ghost tiny" onClick={()=>setForm({...form,logo:''})}>Dùng logo mặc định</button>}</div></div>
      <div><button className="btn green" disabled={busy}>{busy?'Đang lưu…':'Lưu thông tin giải'}</button></div>
    </form>
  </section>;
}
