// HTTP replies can arrive after newer socket snapshots. Never roll a client back.
export function isFreshSnapshot(current, incoming) {
  if(!current || current.schemaVersion!==2)return true;
  if((incoming._version || 0)!==(current._version || 0))return (incoming._version || 0)>(current._version || 0);
  return !current.serverTime || !incoming.serverTime || incoming.serverTime>=current.serverTime;
}
