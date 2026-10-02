import { useEffect, useState } from 'react';
import { db, ref, onValue, request, refreshData } from '../services/dataService';
import { useToast } from './ToastContext';

export default function SecretaryAccounts() {
  const toast=useToast();
  const [accounts,setAccounts]=useState([]),[busy,setBusy]=useState(false);
  const [form,setForm]=useState({name:'',username:'',password:''});
  useEffect(()=>onValue(ref(db,'secretaryAccounts'),s=>setAccounts(s.val()||[])),[]);
  const submit=async e=>{
    e.preventDefault();setBusy(true);
    try {
      await request('/api/auth/accounts',{method:'POST',body:JSON.stringify(form)});
      setForm({name:'',username:'',password:''});
      await refreshData();toast.success('Đã tạo tài khoản thư ký. Có thể phân công vào lịch thi đấu.');
    }catch(err){toast.error(err.message);}finally{setBusy(false);}
  };
  return <section className="card mb24">
    <div className="card-header"><h3 className="text-accent">Tài khoản thư ký</h3></div>
    <p className="text-dim mb16">BTC tạo tài khoản tại đây, sau đó chọn người phụ trách ở từng trận trong lịch thi đấu. Thư ký đăng nhập tại /thuky.</p>
    <form className="grid-2 mb24" onSubmit={submit}>
      <label className="form-label">Họ tên thư ký<input className="input-dark" required maxLength={100} autoComplete="off" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
      <label className="form-label">Tên đăng nhập<input className="input-dark" required minLength={3} maxLength={40} pattern="[a-z0-9_-]{3,40}" autoCapitalize="none" autoComplete="off" spellCheck={false} value={form.username} onChange={e=>setForm({...form,username:e.target.value.toLowerCase()})}/><small>3–40 chữ thường, số, dấu _ hoặc -.</small></label>
      <label className="form-label">Mật khẩu<input className="input-dark" type="password" autoComplete="new-password" required minLength={12} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><small>Ít nhất 12 ký tự. Mật khẩu được bảo vệ tự động.</small></label>
      <div className="form-group"><button className="btn green" disabled={busy}>{busy?'Đang tạo…':'Tạo tài khoản thư ký'}</button></div>
    </form>
    <div className="table-container"><table className="dpl-table"><thead><tr><th>Họ tên</th><th>Tên đăng nhập</th><th>Trạng thái</th></tr></thead><tbody>{accounts.map(a=><tr key={a.username}><td>{a.name}</td><td>{a.username}</td><td><span className={`badge ${a.disabled?'badge-ghost':'badge-accent-glow'}`}>{a.disabled?'Đã khóa':'Đang hoạt động'}</span></td></tr>)}</tbody></table></div>
    {!accounts.length&&<p className="text-dim mt12">Chưa có tài khoản thư ký.</p>}
  </section>;
}
