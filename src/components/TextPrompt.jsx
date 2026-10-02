import { useState, useEffect } from 'react';
export default function TextPrompt(){
  const [request,setRequest]=useState(null),[value,setValue]=useState('');
  useEffect(()=>{const open=e=>{setRequest(e.detail);setValue(String(e.detail.initial ?? ''));};window.addEventListener('dpl-text-prompt',open);return()=>window.removeEventListener('dpl-text-prompt',open);},[]);
  if(!request)return null;
  const finish=result=>{request.resolve(result);setRequest(null);};
  return <div className="modal-backdrop" style={{zIndex:1300}}><form className="modal-card" style={{maxWidth:560,padding:24}} onSubmit={e=>{e.preventDefault();finish(value);}} aria-label="Nhập thông tin xác nhận"><h3 className="text-accent mb16">Thông tin xác nhận</h3><label className="form-label"><span style={{whiteSpace:'pre-wrap'}}>{request.message}</span><input className="input-dark mt12" autoFocus value={value} maxLength={1024} onChange={e=>setValue(e.target.value)}/></label><div className="flex-gap mt16"><button className="btn green" type="submit">Xác nhận</button><button className="btn ghost" type="button" data-modal-close onClick={()=>finish(null)}>Hủy</button></div></form></div>;
}
