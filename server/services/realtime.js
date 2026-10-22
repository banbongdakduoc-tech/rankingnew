// Firebase subscription and HTTP completion can report the same transaction.
export function createVersionedBroadcaster(emit) {
  let lastVersion=-1;
  return state=>{
    const version=state._version || 0;
    if(version<=lastVersion)return;
    lastVersion=version;emit(state);
  };
}
