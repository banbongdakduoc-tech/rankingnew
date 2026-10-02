import { createHash } from 'node:crypto';
import { initialState } from './stateEngine.js';
import { parseMatchMinute, normalizeKickoff } from '../../shared/tournament.js';

// Deterministic IDs keep historical links stable across repeated startup/transactions.
export function migrateState(raw = {}) {
  const state = initialState(raw);
  for (const [team, players] of Object.entries(state.players)) for (const p of players) {
    p.id ||= `legacy_${createHash('sha256').update(`${team}@@${p.num}@@${p.name}`).digest('hex').slice(0,24)}`;
    p.team = team;
  }
  for (const m of Object.values(state.matches)) {
    if(m.date){try{m.date=normalizeKickoff(m.date);}catch{/* Preserve invalid historical dates for BTC review. */}}
    for (const [side,team] of [['lineupA',m.home],['lineupB',m.away]]) for (const p of m[side] || []) {
      p.id ||= (state.players[team] || []).find(x => Number(x.num)===Number(p.num) && x.name===p.name)?.id;
    }
    for (const [i,e] of (m.events || []).entries()) {
      e.id ||= `legacy_${m.id}_${i}`;
      e.playerId ||= (state.players[e.team] || []).find(p => e.player===`${p.num} - ${p.name}` || e.player===p.name)?.id;
      const period=e.period || (Number(e.minute)>Number(state.tourConfig.halfDuration)?2:1);
      try { Object.assign(e,parseMatchMinute(e.displayMinute || e.minute,period)); } catch { e.period=period; }
    }
    if (!m.shootout?.length && m.penA!=='' && m.penA!=null && m.penB!=='' && m.penB!=null) m.legacyPenalty=true;
    m.version ||= 0;
  }
  return state;
}
