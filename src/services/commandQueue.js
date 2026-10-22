// Each command is idempotent; temporary server failures must stay retryable.
export function isTransientCommandError(error) {
  return !error.status || [408,425,429].includes(error.status) || error.status>=500;
}
export function createQueueFlusher({ entries, owner, canSend, send, accept, save, remove, error, settled }) {
  let flight;
  return function flush() {
    if (flight) return flight;
    if (!canSend()) return Promise.resolve();
    const currentOwner=owner();
    flight=(async()=>{
      try {
        while(canSend() && owner()===currentOwner) {
          const entry=(await entries()).filter(x=>x.owner===currentOwner&&!x.conflict&&!x.rejected).sort((a,b)=>a.createdAt-b.createdAt)[0];
          if(!entry || entry.retryAt>Date.now())break;
          try {const result=await send(entry.command);accept(result);await remove(entry.id);}
          catch(e) {
            if(e.status===422) {await remove(entry.id);error(e,entry);continue;}
            if(isTransientCommandError(e)) {
              entry.attempts=(entry.attempts || 0)+1;
              entry.retryAt=Date.now()+Math.min(30000,1000*2**Math.min(entry.attempts,5));
              await save(entry);error(e,entry);break;
            }
            entry.conflict=e.message;entry.conflictStatus=e.status;await save(entry);error(e,entry);if(e.status===401)break;
          }
        }
      } finally {await settled();}
    })().finally(()=>{flight=null;});
    return flight;
  };
}
