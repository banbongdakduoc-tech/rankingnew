import { useEffect, useState } from 'react';
import { elapsedClock, formatMatchMinute, formatSecondsToMMSS } from '../services/tournamentService';
export default function LiveMatchClock({match,halfDuration=20,extraTimeMinutes=0}) {
  const [,tick]=useState(0);
  useEffect(()=>{
    if(match?.status!=='Đang LIVE'||!match?.clock?.running)return;
    const timer=setInterval(()=>tick(n=>n+1),500);return()=>clearInterval(timer);
  },[match?.clock?.running,match?.status]);
  if(!match || match.status==='Sắp diễn ra')return null;
  if(match.status!=='Đang LIVE')return <span className="text-dim">Thời gian thi đấu chính: {halfDuration*2} phút</span>;
  if(!match.clock)return <span className="text-dim">Chưa có đồng hồ trận đấu</span>;
  const seconds=elapsedClock(match.clock),period=match.clock.period || 1;
  return <span className="text-accent" aria-label="Đồng hồ trận đấu">{formatSecondsToMMSS(seconds)} · {formatMatchMinute(seconds,halfDuration,period,extraTimeMinutes).displayMinute}{!match.clock.running?' · Tạm dừng':''}</span>;
}
