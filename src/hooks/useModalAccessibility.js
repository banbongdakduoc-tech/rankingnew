import { useEffect } from 'react';

// Existing dark modal markup stays intact; enforce keyboard access and restore focus.
export default function useModalAccessibility(){
  useEffect(()=>{
    let previous,dialog;
    const candidates=()=>[...(dialog?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')||[])].filter(e=>e.getClientRects().length);
    const watch=()=>{const next=[...document.querySelectorAll('.modal-card')].at(-1);if(next===dialog)return;if(dialog&&!next)previous?.focus();if(next){previous=document.activeElement;dialog=next;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('tabindex','-1');(candidates()[0] || dialog).focus();}else dialog=null;};
    const observer=new MutationObserver(watch);observer.observe(document.body,{childList:true,subtree:true});
    const key=e=>{if(!dialog)return;const list=candidates();if(e.key==='Tab'&&list.length){const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}if(e.key==='Escape'){const close=dialog.querySelector('[data-modal-close],.modal-header button[title*="Đóng"]') || dialog.querySelector('.modal-header .icon-only') || dialog.querySelector('.modal-header button');if(close)close.click();}};
    document.addEventListener('keydown',key);watch();return()=>{observer.disconnect();document.removeEventListener('keydown',key);};
  },[]);
}
