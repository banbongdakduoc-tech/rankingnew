// src/components/KnockoutBracket.jsx
import { useEffect } from 'react';
import { Trophy, Award, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatDateTime } from '../services/tournamentService';

export default function KnockoutBracket({
  matches = [],
  onSelectMatch
}) {
  const koMatches = matches.filter((m) => m.group === 'Vòng Knock-out');

  // Lọc theo từng vòng
  const qfMatches = koMatches.filter((m) => m.round?.includes('Tứ Kết'));
  const sfMatches = koMatches.filter((m) => m.round?.includes('Bán Kết'));
  const thirdMatches = koMatches.filter((m) => m.round?.includes('Tranh Hạng 3'));
  const finalMatches = koMatches.filter((m) => m.round?.includes('Chung Kết'));

  // Kiểm tra nhà vô địch
  const grandFinal = finalMatches[0];
  const champion = grandFinal && grandFinal.status === 'Đã xong' ? grandFinal.advancingTeam : null;

  useEffect(() => {
    if (champion) {
      // Pháo hoa chúc mừng nhà vô địch
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {
        console.log('Confetti error:', e);
      }
    }
  }, [champion]);

  if (koMatches.length === 0) {
    return (
      <div className="empty-state-card">
        <Trophy size={32} className="text-gold mb8" />
        <h3>Sơ đồ Knock-out chưa được kích hoạt</h3>
        <p className="text-dim">Ban tổ chức sẽ công bố nhánh đấu loại trực tiếp sau khi hoàn thành vòng bảng.</p>
      </div>
    );
  }

  const renderMatchCard = (m, isFinal = false, isThird = false) => {
    if (!m) return null;

    const isDone = m.status === 'Đã xong';
    const isLive = m.status === 'Đang LIVE';
    const hasPen = m.penA !== undefined && m.penA !== '' && m.penB !== undefined && m.penB !== '';

    return (
      <div
        key={m.id}
        className={`bracket-match-card ${isFinal ? 'card-final' : ''} ${isThird ? 'card-third' : ''} ${isLive ? 'card-live' : ''}`}
        onClick={() => onSelectMatch && onSelectMatch(m)}
      >
        <div className="bracket-card-header">
          <span className="bracket-round-badge">{m.round}</span>
          {isLive ? (
            <span className="live-tag tiny">
              <span className="live-dot pulse"></span> LIVE
            </span>
          ) : (
            <span className="bracket-time">
              {m.date ? formatDateTime(m.date) : 'Chưa xếp lịch'}
            </span>
          )}
        </div>

        {/* Team 1 (Home) */}
        <div className={`bracket-team-row ${m.advancingTeam === m.home ? 'winner' : ''}`}>
          <div className="team-info">
            {m.advancingTeam === m.home && (
              isFinal ? <CrownIcon /> : <Sparkles size={14} className="text-gold" />
            )}
            <span className="team-name">{m.home || 'Chờ xác định'}</span>
          </div>
          <div className="team-score">
            {isDone || isLive ? (
              <>
                <span className="score-val">{m.scoreA}</span>
                {hasPen && <span className="pen-val">({m.penA})</span>}
              </>
            ) : (
              <span className="score-val dim">-</span>
            )}
          </div>
        </div>

        {/* Team 2 (Away) */}
        <div className={`bracket-team-row ${m.advancingTeam === m.away ? 'winner' : ''}`}>
          <div className="team-info">
            {m.advancingTeam === m.away && (
              isFinal ? <CrownIcon /> : <Sparkles size={14} className="text-gold" />
            )}
            <span className="team-name">{m.away || 'Chờ xác định'}</span>
          </div>
          <div className="team-score">
            {isDone || isLive ? (
              <>
                <span className="score-val">{m.scoreB}</span>
                {hasPen && <span className="pen-val">({m.penB})</span>}
              </>
            ) : (
              <span className="score-val dim">-</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bracket-tree-wrapper">
      {champion && (
        <div className="champion-banner animate-bounce-subtle">
          <Trophy size={36} className="text-gold" />
          <div className="champion-text">
            <span className="champion-label">🏆 NHÀ VÔ ĐỊCH GIẢI ĐẤU</span>
            <span className="champion-name">{champion}</span>
          </div>
        </div>
      )}

      <div className="bracket-stages-container">
        {/* Tứ Kết */}
        {qfMatches.length > 0 && (
          <div className="bracket-column">
            <div className="column-title">
              <span>Tứ Kết</span>
              <span className="round-count">({qfMatches.length} trận)</span>
            </div>
            <div className="matches-column-flow">
              {qfMatches.map((m) => renderMatchCard(m))}
            </div>
          </div>
        )}

        {/* Bán Kết */}
        {sfMatches.length > 0 && (
          <div className="bracket-column">
            <div className="column-title">
              <span>Bán Kết</span>
              <span className="round-count">({sfMatches.length} trận)</span>
            </div>
            <div className="matches-column-flow">
              {sfMatches.map((m) => renderMatchCard(m))}
            </div>
          </div>
        )}

        {/* Chung Kết & Tranh Hạng 3 */}
        {(finalMatches.length > 0 || thirdMatches.length > 0) && (
          <div className="bracket-column finals-column">
            {finalMatches.length > 0 && (
              <div className="final-stage-block">
                <div className="column-title final-title">
                  <Trophy size={16} className="text-gold" />
                  <span>Chung Kết Vô Địch</span>
                </div>
                {finalMatches.map((m) => renderMatchCard(m, true, false))}
              </div>
            )}

            {thirdMatches.length > 0 && (
              <div className="third-stage-block">
                <div className="column-title third-title">
                  <Award size={16} className="text-silver" />
                  <span>Tranh Hạng Ba</span>
                </div>
                {thirdMatches.map((m) => renderMatchCard(m, false, true))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CrownIcon() {
  return (
    <span className="crown-badge" title="Đội Vô Địch">
      👑
    </span>
  );
}
