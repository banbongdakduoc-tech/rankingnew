// Single-flight draining also sends commands added while a request is in flight.
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
          if(!entry)break;
          try {const result=await send(entry.command);accept(result);await remove(entry.id);}
          catch(e) {
            if(e.status===422) {entry.rejected=e.message;await save(entry);error(e);continue;}
            if(e.status) {entry.conflict=e.message;entry.conflictStatus=e.status;await save(entry);error(e);if(e.status===401)break;}
            else {error(e);break;}
          }
        }
      } finally {await settled();}
    })().finally(()=>{flight=null;});
    return flight;
  };
}
