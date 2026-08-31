// src/components/PlayerStatsDetailModal.jsx
import { X, Trophy, AlertTriangle, Shield, Eye, Calendar, Sparkles } from 'lucide-react';
import { formatDateTime, cleanPlayerName } from '../services/tournamentService';

/**
 * Modal hiển thị chi tiết các trận ghi bàn hoặc nhận thẻ của một cầu thủ
 * @param {Object} props
 * @param {Object} props.playerInfo { type: 'goals' | 'cards', data: Object }
 * @param {Array} props.matches Danh sách tất cả các trận đấu
 * @param {Object} props.suspensions Danh sách án phạt treo giò
 * @param {Function} props.onClose Hàm đóng modal
 * @param {Function} props.onSelectMatch Hàm mở xem chi tiết trận đấu
 */
export default function PlayerStatsDetailModal({
  playerInfo,
  matches = [],
  suspensions = {},
  onClose,
  onSelectMatch
}) {
  if (!playerInfo || !playerInfo.data) return null;

  const { type, data } = playerInfo;
  const rawPlayerName = data.rawName || data.displayName;
  const cleanName = cleanPlayerName(rawPlayerName);
  const teamName = data.team;

  // Lọc tất cả các trận đấu mà cầu thủ này có sự kiện liên quan
  const matchHistory = [];

  matches.forEach((m) => {
    if (m.status !== 'Đã xong' && m.status !== 'Đang LIVE') return;

    const playerEvents = (m.events || []).filter((e) => {
      const matchPlayer = e.player === rawPlayerName || cleanPlayerName(e.player) === cleanName;
      const matchTeam = e.team === teamName;
      return matchPlayer && matchTeam;
    });

    if (playerEvents.length === 0) return;

    if (type === 'goals') {
      const goalEvents = playerEvents.filter((e) => e.type === 'goal' && e.detail !== 'own');
      if (goalEvents.length > 0) {
        matchHistory.push({
          match: m,
          events: goalEvents,
          count: goalEvents.length
        });
      }
    } else if (type === 'cards') {
      const cardEvents = playerEvents.filter((e) => e.type === 'card');
      if (cardEvents.length > 0) {
        matchHistory.push({
          match: m,
          events: cardEvents,
          yellowCount: cardEvents.filter((e) => e.detail === 'Vàng' || e.detail === 'yellow').length,
          redCount: cardEvents.filter((e) => e.detail === 'Đỏ' || e.detail === 'red').length
        });
      }
    }
  });

  // Kiểm tra tình trạng treo giò
  const pKey = `${teamName}@@${rawPlayerName}`;
  const activeSuspension = suspensions[pKey];

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div
        className="modal-card modal-lg animate-scale-up"
        style={{ maxWidth: '720px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className={`badge ${type === 'goals' ? 'badge-accent-glow' : 'badge-danger'}`}>
              {type === 'goals' ? '👟 Chi Tiết Bàn Thắng' : '🚨 Hồ Sơ Kỷ Luật & Thẻ Phạt'}
            </span>
            <h2 className="modal-title">{cleanName}</h2>
          </div>
          <button type="button" className="btn ghost icon-only" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: '16px' }}>
          {/* Player Profile Banner */}
          <div
            style={{
              background: type === 'goals'
                ? 'linear-gradient(135deg, rgba(0, 255, 135, 0.1) 0%, rgba(245, 158, 11, 0.08) 100%)'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
              border: type === 'goals' ? '1px solid rgba(0, 255, 135, 0.3)' : '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {data.avatar ? (
                <img
                  src={data.avatar}
                  alt={cleanName}
                  style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-green)' }}
                />
              ) : (
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'var(--bg-card-alt)',
                    border: '2px solid var(--border-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: '800',
                    color: 'var(--accent-green)'
                  }}
                >
                  <Shield size={26} />
                </div>
              )}

              <div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: '#FFFFFF' }}>
                  {cleanName}
                </div>
                <div className="text-dim" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span>Đội bóng: <b>{teamName}</b></span>
                  {data.rank && <span>• Xếp hạng: <b className="text-gold">#{data.rank}</b></span>}
                </div>
              </div>
            </div>

            {/* Stat Total Counter */}
            {type === 'goals' ? (
              <div style={{ textAlign: 'right' }}>
                <div className="text-dim" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Tổng số bàn thắng
                </div>
                <div style={{ fontSize: '32px', fontFamily: 'var(--font-display)', fontWeight: '900', color: 'var(--accent-gold)' }}>
                  {data.goals} <span style={{ fontSize: '20px' }}>⚽</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 'var(--radius-md)', padding: '6px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10.5px', color: 'var(--accent-gold)', fontWeight: '700' }}>THẺ VÀNG</div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--accent-gold)' }}>
                    {data.yellow || 0} 🟨
                  </div>
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 'var(--radius-md)', padding: '6px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10.5px', color: 'var(--accent-red)', fontWeight: '700' }}>THẺ ĐỎ</div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--accent-red)' }}>
                    {data.red || 0} 🟥
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active Suspension Notice (nếu có) */}
          {activeSuspension && (
            <div style={{ padding: '14px 18px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--accent-red)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ color: 'var(--accent-red)', fontWeight: '800', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={17} /> CẦU THỦ ĐANG CHỊU ÁN PHẠT TREO GIÒ (CẤM THI ĐẤU)
              </div>
              <div style={{ fontSize: '13px', color: '#FFFFFF', marginTop: '4px' }}>
                Lý do: <b>{activeSuspension.reason}</b>
              </div>
            </div>
          )}

          {/* Title List */}
          <div className="flex-between">
            <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              {type === 'goals' ? <Trophy size={16} className="text-gold" /> : <Shield size={16} className="text-red" />}
              <span>{type === 'goals' ? 'DANH SÁCH CÁC TRẬN ĐÃ GHI BÀN' : 'DANH SÁCH CÁC TRẬN ĐÃ NHẬN THẺ'} ({matchHistory.length} TRẬN)</span>
            </h4>
          </div>

          {/* Match History List */}
          {matchHistory.length === 0 ? (
            <div className="event-empty-box">
              <div className="text-dim" style={{ fontSize: '13px' }}>
                Chưa có dữ liệu trận đấu chi tiết nào cho cầu thủ này.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {matchHistory.map((item, idx) => {
                const m = item.match;
                const isHome = m.home === teamName;

                return (
                  <div
                    key={m.id || idx}
                    style={{
                      background: '#090E16',
                      border: '1px solid var(--border-card)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 18px',
                      transition: 'border-color 0.2s ease'
                    }}
                  >
                    {/* Header: Stage + Time + View Button */}
                    <div className="flex-between mb10">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-ghost" style={{ fontSize: '11px' }}>
                          {m.round || m.group}
                        </span>
                        {m.date && (
                          <span className="text-dim" style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={12} /> {formatDateTime(m.date)}
                          </span>
                        )}
                      </div>

                      {onSelectMatch && (
                        <button
                          type="button"
                          className="btn ghost tiny"
                          style={{ color: 'var(--accent-green)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => onSelectMatch(m)}
                        >
                          <Eye size={12} /> Xem trận
                        </button>
                      )}
                    </div>

                    {/* Scoreboard Bar */}
                    <div
                      style={{
                        background: '#05090F',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '10px'
                      }}
                    >
                      <div style={{ fontWeight: isHome ? '900' : '600', color: isHome ? 'var(--accent-green)' : 'var(--text-primary)', fontSize: '14px' }}>
                        {m.home} {isHome && '⭐'}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px', fontWeight: '900', fontFamily: 'var(--font-display)', color: 'var(--accent-green)' }}>
                          {m.scoreA ?? 0}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>:</span>
                        <span style={{ fontSize: '20px', fontWeight: '900', fontFamily: 'var(--font-display)', color: 'var(--accent-green)' }}>
                          {m.scoreB ?? 0}
                        </span>
                        {m.penA !== undefined && m.penA !== '' && (
                          <span className="badge tiny text-gold" style={{ marginLeft: '4px' }}>
                            Pen {m.penA}-{m.penB}
                          </span>
                        )}
                      </div>

                      <div style={{ fontWeight: !isHome ? '900' : '600', color: !isHome ? 'var(--accent-green)' : 'var(--text-primary)', fontSize: '14px' }}>
                        {!isHome && '⭐'} {m.away}
                      </div>
                    </div>

                    {/* Breakdown of goals / cards in this match */}
                    {type === 'goals' ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Sparkles size={13} /> Ghi {item.count} bàn:
                        </span>
                        {item.events.map((ev) => (
                          <span
                            key={ev.id}
                            style={{
                              background: 'rgba(0, 255, 135, 0.12)',
                              border: '1px solid rgba(0, 255, 135, 0.35)',
                              borderRadius: '999px',
                              padding: '2px 10px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              color: 'var(--accent-green)'
                            }}
                          >
                            ⚽ Phút {ev.displayMinute || `${ev.minute}'`} {ev.detail === 'pen' ? '(Penalty)' : ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                          Thẻ phạt trong trận:
                        </span>
                        {item.events.map((ev) => {
                          const isYellow = ev.detail === 'Vàng' || ev.detail === 'yellow';
                          return (
                            <span
                              key={ev.id}
                              style={{
                                background: isYellow ? 'var(--accent-gold)' : 'var(--accent-red)',
                                color: isYellow ? '#000' : '#FFF',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                fontSize: '11.5px',
                                fontWeight: '800'
                              }}
                            >
                              {isYellow ? '🟨 Thẻ Vàng' : '🟥 Thẻ Đỏ'} - Phút {ev.displayMinute || `${ev.minute}'`}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn ghost" onClick={onClose}>
            Đóng Cửa Sổ
          </button>
        </div>
      </div>
    </div>
  );
}
