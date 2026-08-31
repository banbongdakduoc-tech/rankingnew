// src/components/MatchDetailModal.jsx
import {
  X,
  Calendar,
  User,
  Shield,
  Trophy,
  Printer,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ArrowLeft
} from 'lucide-react';
import { formatDateTime, cleanPlayerName } from '../services/tournamentService';

export default function MatchDetailModal({
  match,
  onClose,
  onPrint,
  isPublicView = false,
  backLabel = 'Đóng'
}) {
  if (!match) return null;

  const events = (match.events || []).slice().sort((a, b) => Number(a.minute) - Number(b.minute));
  const hasPen = match.penA !== undefined && match.penA !== '' && match.penB !== undefined && match.penB !== '';

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-card modal-lg animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="badge badge-accent-glow">
              {match.round || match.group || 'Trận Đấu'}
            </span>
            <h2 className="modal-title">Chi Tiết Trận Đấu</h2>
          </div>
          <div className="modal-actions">
            {backLabel !== 'Đóng' && (
              <button
                type="button"
                className="btn ghost small"
                onClick={onClose}
                style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '5px' }}
                title="Quay lại hồ sơ cầu thủ"
              >
                <ArrowLeft size={14} />
                <span>Quay lại</span>
              </button>
            )}
            {!isPublicView && onPrint && (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => onPrint(match)}
                title="In biên bản trận đấu"
              >
                <Printer size={15} />
                <span>In Biên Bản</span>
              </button>
            )}
            <button
              type="button"
              className="btn ghost icon-only"
              onClick={onClose}
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Match Score Banner */}
          <div className="match-banner">
            <div className="match-meta-bar">
              <div className="meta-item">
                <Calendar size={14} className="text-accent" />
                <span>{formatDateTime(match.date)}</span>
              </div>
              {match.status === 'Đang LIVE' ? (
                <div className="live-tag">
                  <span className="live-dot pulse"></span>
                  <span>TRỰC TIẾP</span>
                </div>
              ) : (
                <span className="badge badge-ghost">{match.status}</span>
              )}
            </div>

            <div className="scoreboard-container">
              {/* Home Team */}
              <div className="team-side home">
                <div className="team-badge">
                  <Shield size={28} className="text-accent" />
                </div>
                <div className="team-name">{match.home}</div>
                {match.advancingTeam === match.home && (
                  <div className="advancing-badge">
                    <Trophy size={13} />
                    <span>ĐI TIẾP</span>
                  </div>
                )}
              </div>

              {/* Score Display */}
              <div className="score-center">
                <div className="score-number-box">
                  <span className="score-num">
                    {match.status === 'Sắp diễn ra' ? '-' : match.scoreA ?? 0}
                  </span>
                  <span className="score-divider">:</span>
                  <span className="score-num">
                    {match.status === 'Sắp diễn ra' ? '-' : match.scoreB ?? 0}
                  </span>
                </div>

                {hasPen && (
                  <div className="penalty-score">
                    (Pen: {match.penA} - {match.penB})
                  </div>
                )}
              </div>

              {/* Away Team */}
              <div className="team-side away">
                <div className="team-badge">
                  <Shield size={28} className="text-accent" />
                </div>
                <div className="team-name">{match.away}</div>
                {match.advancingTeam === match.away && (
                  <div className="advancing-badge">
                    <Trophy size={13} />
                    <span>ĐI TIẾP</span>
                  </div>
                )}
              </div>
            </div>

            {/* Officials Info */}
            <div className="match-officials-bar">
              <div className="official-chip">
                <User size={13} className="text-dim" />
                <span>Trọng tài: <b>{match.ref || 'Chưa phân công'}</b></span>
              </div>
              <div className="official-chip">
                <User size={13} className="text-dim" />
                <span>Thư ký: <b>{match.sec || 'Chưa phân công'}</b></span>
              </div>
            </div>
          </div>

          {/* Events Timeline */}
          <div className="section-block">
            <h3 className="section-title">
              <span>⏱️ Diễn Biến & Sự Kiện Trận Đấu</span>
            </h3>

            {events.length === 0 ? (
              <div className="empty-state-card">
                <AlertCircle size={24} className="text-dim" />
                <p>Chưa có sự kiện nào được ghi nhận trong trận đấu này.</p>
              </div>
            ) : (
              <div className="events-timeline">
                {events.map((e) => {
                  const isHome = e.team === match.home;

                  return (
                    <div key={e.id || `${e.minute}-${e.player}`} className="timeline-item">
                      {/* Left: Home Event */}
                      <div className={`timeline-side home ${isHome ? 'active' : ''}`}>
                        {isHome && (
                          <div className="event-pill">
                            <span className="event-player">{cleanPlayerName(e.player)}</span>
                            <span className="event-badge-icon">
                              {e.type === 'goal' && (
                                e.detail === 'own' ? '⚽ (Phản lưới)' : e.detail === 'pen' ? '⚽ (Penalty)' : '⚽'
                              )}
                              {e.type === 'card' && (
                                e.detail === 'Vàng' || e.detail === 'yellow' ? '🟨' : '🟥'
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Center: Minute */}
                      <div className="timeline-minute">
                        <span>{e.displayMinute || `${e.minute}'`}</span>
                      </div>

                      {/* Right: Away Event */}
                      <div className={`timeline-side away ${!isHome ? 'active' : ''}`}>
                        {!isHome && (
                          <div className="event-pill">
                            <span className="event-badge-icon">
                              {e.type === 'goal' && (
                                e.detail === 'own' ? '⚽ (Phản lưới)' : e.detail === 'pen' ? '⚽ (Penalty)' : '⚽'
                              )}
                              {e.type === 'card' && (
                                e.detail === 'Vàng' || e.detail === 'yellow' ? '🟨' : '🟥'
                              )}
                            </span>
                            <span className="event-player">{cleanPlayerName(e.player)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lineups Row (Chỉ hiển thị cho Thư ký / BTC, Khán giả KHÔNG được coi) */}
          {!isPublicView && ((match.lineupA && match.lineupA.length > 0) || (match.lineupB && match.lineupB.length > 0)) && (
            <div className="section-block">
              <h3 className="section-title">
                <span>📋 Đội Hình Ra Sân</span>
              </h3>
              <div className="lineups-grid">
                <div className="lineup-col">
                  <div className="lineup-col-header">{match.home}</div>
                  <div className="lineup-list">
                    {(match.lineupA || []).filter(p => p.played).map((p, i) => (
                      <div key={i} className="lineup-player-row">
                        <span className="player-num">#{p.num}</span>
                        <span className="player-name">{p.name} {p.shirtName ? `(${p.shirtName})` : ''}</span>
                        <CheckCircle2 size={14} className="text-accent" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lineup-col">
                  <div className="lineup-col-header">{match.away}</div>
                  <div className="lineup-list">
                    {(match.lineupB || []).filter(p => p.played).map((p, i) => (
                      <div key={i} className="lineup-player-row">
                        <span className="player-num">#{p.num}</span>
                        <span className="player-name">{p.name} {p.shirtName ? `(${p.shirtName})` : ''}</span>
                        <CheckCircle2 size={14} className="text-accent" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Secretary Notes (Chỉ hiển thị cho Thư ký / BTC) */}
          {!isPublicView && match.secretaryNote && (
            <div className="section-block">
              <h3 className="section-title">
                <span>📝 Ghi Chú Của Thư Ký Bàn</span>
              </h3>
              <div style={{ background: 'var(--bg-secondary)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontStyle: 'italic', color: '#E2E8F0', fontSize: '13px' }}>
                <MessageSquare size={14} className="text-accent" style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                "{match.secretaryNote}"
              </div>
            </div>
          )}

          {/* Digital Signatures (Chỉ hiển thị cho Thư ký / BTC) */}
          {!isPublicView && match.signatures && (
            <div className="section-block">
              <h3 className="section-title">
                <span>✍️ Chữ Ký Xác Nhận Biên Bản Điện Tử</span>
              </h3>
              <div className="signatures-display-grid">
                <div className="signature-preview-card">
                  <div className="sig-preview-label">Đội trưởng {match.home}</div>
                  {match.signatures.home ? (
                    <img src={match.signatures.home} alt="Chữ ký đội nhà" className="sig-img" />
                  ) : (
                    <div className="sig-none">Chưa ký</div>
                  )}
                </div>

                <div className="signature-preview-card">
                  <div className="sig-preview-label">Đội trưởng {match.away}</div>
                  {match.signatures.away ? (
                    <img src={match.signatures.away} alt="Chữ ký đội khách" className="sig-img" />
                  ) : (
                    <div className="sig-none">Chưa ký</div>
                  )}
                </div>

                <div className="signature-preview-card">
                  <div className="sig-preview-label">Trọng tài chính</div>
                  {match.signatures.referee ? (
                    <img src={match.signatures.referee} alt="Chữ ký trọng tài" className="sig-img" />
                  ) : (
                    <div className="sig-none">Chưa ký</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button type="button" className="btn ghost" onClick={onClose}>
            {backLabel !== 'Đóng' && <ArrowLeft size={16} />}
            <span>{backLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
