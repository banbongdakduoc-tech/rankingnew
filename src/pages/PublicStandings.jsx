// src/pages/PublicStandings.jsx
import { useState, useEffect } from 'react';
import { ref, onValue } from '../services/dataService';
import { db, request } from '../services/dataService';
import {
  Trophy,
  Calendar,
  CheckCircle2,
  Clock,
  Award,
  Users,
  Search,
  Eye,
  ChevronRight,
  Shield,
  Sparkles
} from 'lucide-react';
import {
  calculateGroupStandings,
  getTopScorers,
  getDisciplineStats,
  formatDateTime,
  isGroupStageFinished,
  getQualifyingCount
} from '../services/tournamentService';
import MatchDetailModal from '../components/MatchDetailModal';
import KnockoutBracket from '../components/KnockoutBracket';
import PlayerStatsDetailModal from '../components/PlayerStatsDetailModal';

export default function PublicStandings() {
  // ==========================================
  // 1. STATE ĐỒNG BỘ TỪ FIREBASE
  // ==========================================
  const [tourConfig, setTourConfig] = useState({
    name: 'Dược Premier League 2026',
    format: 'group',
    numGroups: 2,
    knockoutFormat: 'quarter'
  });
  const [tourStatus, setTourStatus] = useState('none');
  const [groupsData, setGroupsData] = useState([]);
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState({});
  const [suspensions, setSuspensions] = useState({});

  // Active view tab in Public Hub
  const provisional = false;
  const [favorite, setFavorite] = useState(() => localStorage.getItem('dpl-favorite-team') || '');
  const [rankingInfo, setRankingInfo] = useState(null);
  const [publicTab, setPublicTab] = useState('bxh'); // 'bxh', 'lichthidau', 'knockout', 'thongke', 'doihinh'
  const [scheduleSubTab, setScheduleSubTab] = useState('upcoming'); // 'upcoming', 'completed'
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');
  const [searchMatchTxt, setSearchMatchTxt] = useState('');

  // Team roster view filter
  const [selectedTeamRoster, setSelectedTeamRoster] = useState('');

  // Modals
  const [viewingMatch, setViewingMatch] = useState(null);
  const [viewingPlayerStats, setViewingPlayerStats] = useState(null);

  const [seasonId,setSeasonId]=useState('');
  const [seasonHistory,setSeasonHistory]=useState([]);
  const [seasonError,setSeasonError]=useState('');
  const [statsPhase,setStatsPhase]=useState('all');
  useEffect(()=>{
    let active=true;
    const apply=data=>{if(!active)return;setTourConfig(data.tourConfig);setTourStatus(data.tourStatus);setGroupsData(data.groupsData||[]);const list=Object.values(data.matches||{}).filter(m=>!['Chờ duyệt','Bị từ chối'].includes(m.status));setMatches(list);setPlayers(data.players||{});setSuspensions(data.suspensions||{});const requested=new URLSearchParams(window.location.search).get('match');if(requested)setViewingMatch(list.find(m=>m.id===requested)||null);};
    const stop=onValue(ref(db),snap=>{const data=snap.val();if(!data)return;setSeasonHistory(data.seasonHistory||[]);if(!seasonId)apply(data);});
    if(seasonId)request(`/api/seasons/${encodeURIComponent(seasonId)}`).then(res=>{apply(res.data);setSeasonError('');}).catch(e=>{if(active)setSeasonError(e.message);});
    return()=>{active=false;stop();};
  },[seasonId]);

  // Not started state
  if (tourStatus === 'none' || tourStatus === 'config' || tourStatus === 'setup_teams') {
    return (
      <div className="app-container">{seasonHistory.length>0&&<label className="form-label mb16">Hồ sơ mùa giải<select className="select-dark" value={seasonId} onChange={e=>{setSeasonId(e.target.value);setFavorite('');setViewingMatch(null);}}><option value="">Mùa hiện hành</option>{seasonHistory.map(s=><option key={s.id} value={s.id}>{s.name} · {new Date(s.at).toLocaleDateString('vi-VN')}</option>)}</select></label>}{seasonError&&<p className="text-red" role="alert">{seasonError}</p>}
        <div className="card text-center" style={{ padding: '60px 20px', maxWidth: '600px', margin: '40px auto' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0,255,135,0.1)', border: '1px solid rgba(0,255,135,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Trophy size={32} className="text-accent" />
          </div>
          <h2 style={{ fontSize: '22px', marginBottom: '12px' }}>Mùa Giải Chưa Khởi Tranh</h2>
          <p className="text-dim" style={{ maxWidth: '440px', margin: '0 auto 24px', fontSize: '14px' }}>
            Ban Tổ Chức đang trong giai đoạn tiếp nhận danh sách đội bóng và sắp xếp lịch thi đấu chính thức. Quý khán giả vui lòng quay lại sau!
          </p>
          <div className="badge badge-ghost">Hệ thống đang sẵn sàng</div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. TÍNH TOÁN & LỌC DỮ LIỆU
  // ==========================================
  const liveMatches = matches.filter((m) => m.status === 'Đang LIVE');

  // Lọc lịch thi đấu
  const upcomingMatches = matches
    .filter((m) => m.status === 'Sắp diễn ra')
    .filter(m => !favorite || m.home === favorite || m.away === favorite)
    .filter((m) => (!selectedGroupFilter || m.group === selectedGroupFilter))
    .filter((m) => (!searchMatchTxt || m.home?.toLowerCase().includes(searchMatchTxt.toLowerCase()) || m.away?.toLowerCase().includes(searchMatchTxt.toLowerCase())))
    .sort((a, b) => new Date(a.date || '9999-12-31') - new Date(b.date || '9999-12-31'));

  const completedMatches = matches
    .filter((m) => m.status === 'Đã xong')
    .filter(m => !favorite || m.home === favorite || m.away === favorite)
    .filter((m) => (!selectedGroupFilter || m.group === selectedGroupFilter))
    .filter((m) => (!searchMatchTxt || m.home?.toLowerCase().includes(searchMatchTxt.toLowerCase()) || m.away?.toLowerCase().includes(searchMatchTxt.toLowerCase())))
    .sort((a, b) => new Date(b.date || '1970-01-01') - new Date(a.date || '1970-01-01'));

  // Thống kê cá nhân
  const phaseMatches=matches.filter(m=>statsPhase==='all'||(statsPhase==='ko')===(m.group==='Vòng Knock-out'));
  const topScorers = getTopScorers(phaseMatches, players, { provisional });
  const topCards = getDisciplineStats(phaseMatches, { provisional });

  // Danh sách các đội
  const allTeamsList = groupsData.flatMap((g) => g.teams || []);
  const activeTeamRoster = selectedTeamRoster || allTeamsList[0] || '';
  const currentRosterPlayers = players[activeTeamRoster] || [];

  // Vòng bảng & Highlight Rules
  const groupStageFinished = isGroupStageFinished(matches);
  const currentKnockoutFormat = tourConfig.knockoutFormat || 'quarter';
  const qualifyCount = getQualifyingCount(currentKnockoutFormat, groupsData.length);
  const totalGroupMatches = matches.filter((m) => m.group !== 'Vòng Knock-out').length;
  const completedGroupMatches = matches.filter((m) => m.group !== 'Vòng Knock-out' && m.status === 'Đã xong').length;

  return (
    <div className="app-container animate-fade-in">{seasonHistory.length>0&&<label className="form-label mb16">Hồ sơ mùa giải<select className="select-dark" value={seasonId} onChange={e=>{setSeasonId(e.target.value);setFavorite('');setViewingMatch(null);}}><option value="">Mùa hiện hành</option>{seasonHistory.map(s=><option key={s.id} value={s.id}>{s.name} · {new Date(s.at).toLocaleDateString('vi-VN')}</option>)}</select></label>}{seasonError&&<p className="text-red" role="alert">{seasonError}</p>}
      {publicTab==='thongke'&&<label className="form-label mb16">Phạm vi thống kê<select className="select-dark" value={statsPhase} onChange={e=>setStatsPhase(e.target.value)}><option value="all">Toàn giải</option><option value="group">Vòng bảng</option><option value="ko">Knockout</option></select></label>}
      <div className="favorites-bar">
        <select className="select-dark" aria-label="Đội yêu thích" style={{ maxWidth: 240 }} value={favorite} onChange={e => { setFavorite(e.target.value); localStorage.setItem('dpl-favorite-team', e.target.value); }}><option value="">Lịch của tất cả đội</option>{allTeamsList.map(t => <option key={t} value={t}>★ {t}</option>)}</select>
      </div>
      {rankingInfo && <div className="modal-backdrop" onClick={() => setRankingInfo(null)}><div className="modal-card" onClick={e => e.stopPropagation()} style={{ padding: 24 }}><div className="modal-header"><h3 className="text-accent">Giải thích thứ hạng · {rankingInfo.groupName}</h3><button className="btn ghost" onClick={() => setRankingInfo(null)}>Đóng</button></div><p className="text-dim mb12">Điểm → bảng phụ H2H (Điểm, GD, GF) → GD toàn bảng → GF toàn bảng → tên. Hai lượt đối đầu đều được xét; nhóm con còn bằng nhau được xét lại theo điều lệ.</p><table className="dpl-table"><thead><tr><th>Đội</th><th>Điểm</th><th>Tiêu chí</th></tr></thead><tbody>{calculateGroupStandings(rankingInfo.teams, matches.filter(m => m.group === rankingInfo.groupName), { provisional }).map(t => <tr key={t.name}><td>{t.name}</td><td>{t.pts}</td><td>{t.tieBreak || 'Khác điểm'} · GD toàn bảng {t.gd} · GF {t.gf}</td></tr>)}</tbody></table></div></div>}
      {/* MODALS DISPLAY: NẾU ĐANG XEM TRẬN THÌ HIỆN MATCH DETAIL, KHI ĐÓNG TRẬN SẼ TRẢ VỀ HỒ SƠ CẦU THỦ */}
      {viewingMatch ? (
        <MatchDetailModal
          match={matches.find(m => m.id === viewingMatch.id) || viewingMatch}
          isPublicView={true}
          backLabel={viewingPlayerStats ? 'Quay lại hồ sơ cầu thủ' : 'Đóng'}
          onClose={() => { setViewingMatch(null); const url = new URL(window.location.href); url.searchParams.delete('match'); window.history.replaceState({}, '', url); }}
        />
      ) : viewingPlayerStats ? (
        <PlayerStatsDetailModal
          playerInfo={viewingPlayerStats}
          matches={matches.filter(m => m.status === 'Đã xong' || provisional && ['Đang LIVE', 'Chờ duyệt'].includes(m.status))}
          suspensions={suspensions}
          onClose={() => setViewingPlayerStats(null)}
          onSelectMatch={(m) => setViewingMatch(m)}
        />
      ) : null}

      {/* ======================================================== */}
      {/* 1. KHU VỰC TRẬN ĐẤU ĐANG LIVE (HOT) */}
      {/* ======================================================== */}
      {liveMatches.length > 0 && (
        <section className="mb24">
          <div className="flex-between mb12">
            <div className="flex-row">
              <span className="live-dot pulse"></span>
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#FF5A5A', letterSpacing: '0.05em' }}>
                TRẬN ĐẤU ĐANG DIỄN RA (LIVE)
              </h2>
            </div>
            <span className="badge badge-live">{liveMatches.length} Trận Trực Tiếp</span>
          </div>

          <div className="live-matches-grid">
            {liveMatches.map((m) => (
              <div
                key={m.id}
                className="live-match-card"
                onClick={() => setViewingMatch(m)}
              >
                <div className="live-card-header">
                  <span className="badge badge-ghost" style={{ fontSize: '11px' }}>
                    {m.round || m.group}
                  </span>
                  <div className="live-tag">
                    <span className="live-dot pulse"></span>
                    <span>TRỰC TIẾP</span>
                  </div>
                </div>

                <div className="live-scoreboard">
                  <div className="live-team home">{m.home}</div>
                  <div className="live-score-display">
                    <span className="live-score-num">{m.scoreA ?? 0}</span>
                    <span style={{ color: '#64748B', fontWeight: 'bold' }}>:</span>
                    <span className="live-score-num">{m.scoreB ?? 0}</span>
                  </div>
                  <div className="live-team away">{m.away}</div>
                </div>

                {m.penA !== undefined && m.penA !== '' && (
                  <div className="text-center text-gold font-bold" style={{ fontSize: '12px', marginBottom: '8px' }}>
                    Pen: {m.penA} - {m.penB}
                  </div>
                )}

                <div className="flex-between mt8" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                  <span className="text-dim" style={{ fontSize: '12px' }}>
                    {m.ref ? `TT: ${m.ref}` : 'Bấm xem diễn biến'}
                  </span>
                  <span className="btn ghost tiny" style={{ color: 'var(--accent-green)' }}>
                    Chi tiết <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 2. SUB NAVIGATION TABS */}
      {/* ======================================================== */}
      <div className="card mb24" style={{ padding: '8px 12px' }}>
        <div className="navbar-nav" style={{ background: 'transparent', border: 'none', width: '100%', overflowX: 'auto' }}>
          <button
            className={`nav-link ${publicTab === 'bxh' ? 'active' : ''}`}
            onClick={() => setPublicTab('bxh')}
          >
            <Trophy size={16} />
            <span>Bảng Xếp Hạng</span>
          </button>

          <button
            className={`nav-link ${publicTab === 'lichthidau' ? 'active' : ''}`}
            onClick={() => setPublicTab('lichthidau')}
          >
            <Calendar size={16} />
            <span>Lịch & Kết Quả</span>
          </button>

          <button
            className={`nav-link ${publicTab === 'knockout' ? 'active' : ''}`}
            onClick={() => setPublicTab('knockout')}
          >
            <Award size={16} />
            <span>Sơ Đồ Knock-out</span>
          </button>

          <button
            className={`nav-link ${publicTab === 'thongke' ? 'active' : ''}`}
            onClick={() => setPublicTab('thongke')}
          >
            <Award size={16} />
            <span>Vua Phá Lưới & Kỷ Luật</span>
          </button>

          <button
            className={`nav-link ${publicTab === 'doihinh' ? 'active' : ''}`}
            onClick={() => setPublicTab('doihinh')}
          >
            <Users size={16} />
            <span>Đội Hình Thi Đấu</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: BẢNG XẾP HẠNG VÒNG BẢNG (HIGHLIGHT CHUẨN) */}
      {/* ======================================================== */}
      {publicTab === 'bxh' && (
        <section className="animate-fade-in">
          {/* Group Stage Status Banner */}
          <div className="card mb16" style={{ background: groupStageFinished ? 'rgba(0,255,135,0.06)' : 'var(--bg-secondary)', border: groupStageFinished ? '1px solid rgba(0,255,135,0.3)' : '1px solid var(--border-subtle)', padding: '14px 18px' }}>
            <div className="flex-between">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {groupStageFinished ? (
                  <Sparkles size={20} className="text-accent" />
                ) : (
                  <Clock size={20} className="text-gold" />
                )}
                <div>
                  <div style={{ fontWeight: '800', fontSize: '14px', color: groupStageFinished ? 'var(--accent-green)' : 'var(--accent-gold)' }}>
                    {groupStageFinished ? 'VÒNG BẢNG ĐÃ HOÀN TẤT CHÍNH THỨC' : 'VÒNG BẢNG ĐANG DIỄN RA GIAY CẤN'}
                  </div>
                  <div className="text-dim" style={{ fontSize: '12.5px', marginTop: '2px' }}>
                    {groupStageFinished ? (
                      <span>
                        Top <b>{qualifyCount} đội đứng đầu</b> mỗi bảng đã chính thức giành quyền bước vào vòng <b>{currentKnockoutFormat === 'quarter' ? 'TỨ KẾT' : 'BÁN KẾT'}</b>.
                      </span>
                    ) : (
                      <span>
                        Đã thi đấu {completedGroupMatches}/{totalGroupMatches} trận. Suất vé đi tiếp ({qualifyCount} đội/bảng) sẽ được chốt và highlight khi vòng bảng kết thúc.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <span className={`badge ${groupStageFinished ? 'badge-accent-glow' : 'badge-pending'}`}>
                {groupStageFinished ? 'Đã Chốt Vé' : `${completedGroupMatches}/${totalGroupMatches} Trận`}
              </span>
            </div>
          </div>

          {groupsData.length === 0 ? (
            <div className="empty-state-card">Chưa có thông tin bảng đấu</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {groupsData.map((g, idx) => {
                const groupMatches = matches.filter(
                  (m) => m.group === g.groupName && ['Đã xong', 'Đang LIVE', 'Chờ duyệt'].includes(m.status)
                );
                const standings = calculateGroupStandings(g.teams || [], groupMatches, { provisional, reapplyH2H: tourConfig.reapplyH2H });

                return (
                  <div key={idx} className="card">
                    <div className="card-header">
                      <div className="card-title">
                        <span className="badge badge-accent-glow">{g.groupName}</span>
                        <span>Bảng Xếp Hạng Chi Tiết</span><button className="btn ghost tiny" onClick={() => setRankingInfo(g)}>Giải thích H2H</button>
                      </div>
                      <span className="text-dim" style={{ fontSize: '12px' }}>
                        {groupStageFinished
                          ? `Top ${qualifyCount} đội giành vé vào ${currentKnockoutFormat === 'quarter' ? 'Tứ Kết' : 'Bán Kết'}`
                          : `Đang tranh ${qualifyCount} suất vé đi tiếp`}
                      </span>
                    </div>

                    <div className="table-container">
                      <table className="dpl-table">
                        <thead>
                          <tr>
                            <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                            <th>Đội Bóng</th>
                            <th style={{ textAlign: 'center', width: '50px' }}>Trận</th>
                            <th style={{ textAlign: 'center', width: '45px' }}>T</th>
                            <th style={{ textAlign: 'center', width: '45px' }}>H</th>
                            <th style={{ textAlign: 'center', width: '45px' }}>B</th>
                            <th style={{ textAlign: 'center', width: '50px' }}>BT</th>
                            <th style={{ textAlign: 'center', width: '50px' }}>BB</th>
                            <th style={{ textAlign: 'center', width: '55px' }}>HS</th>
                            <th style={{ textAlign: 'center', width: '65px', fontWeight: 'bold' }}>Điểm</th>
                            <th style={{ textAlign: 'center', width: '130px' }}>5 Trận Gần Nhất</th>
                            {groupStageFinished && <th style={{ textAlign: 'center' }}>Trạng Thái</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((t, index) => {
                            // Chỉ highlight khi vòng bảng đã kết thúc 100%
                            const isQualifying = groupStageFinished && index < qualifyCount;

                            return (
                              <tr
                                key={t.name}
                                className={isQualifying ? 'standings-row-qualify' : ''}
                              >
                                <td style={{ textAlign: 'center', fontWeight: 'bold', color: isQualifying ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                                  {index + 1}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Shield size={16} className={isQualifying ? 'text-accent' : 'text-dim'} />
                                    <span style={{ fontWeight: '700' }}>{t.name}</span>
                                    {isQualifying && (
                                      <span className="badge tiny" style={{ background: 'rgba(0,255,135,0.15)', color: 'var(--accent-green)', fontSize: '9.5px', padding: '1px 6px', fontWeight: 'bold' }}>
                                        Vé Vàng
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t.p}</td>
                                <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t.w}</td>
                                <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t.d}</td>
                                <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t.l}</td>
                                <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t.gf}</td>
                                <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t.ga}</td>
                                <td style={{ textAlign: 'center', fontWeight: '600', color: t.gd > 0 ? 'var(--accent-green)' : t.gd < 0 ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                                  {t.gd > 0 ? `+${t.gd}` : t.gd}
                                </td>
                                <td style={{ textAlign: 'center', fontWeight: '800', fontSize: '15px', color: 'var(--accent-green)' }}>
                                  {t.pts}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {t.form.length === 0 ? (
                                    <span className="text-muted" style={{ fontSize: '12px' }}>Chưa đá</span>
                                  ) : (
                                    <div className="form-badges" style={{ justifyContent: 'center' }}>
                                      {t.form.map((f, fi) => (
                                        <span key={fi} className={`form-dot ${f.toLowerCase()}`}>
                                          {f}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                {groupStageFinished && (
                                  <td style={{ textAlign: 'center' }}>
                                    {isQualifying ? (
                                      <span className="badge badge-accent-glow" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        🏆 Vé {currentKnockoutFormat === 'quarter' ? 'Tứ Kết' : 'Bán Kết'}
                                      </span>
                                    ) : (
                                      <span className="text-dim" style={{ fontSize: '12px' }}>Dừng bước</span>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* TAB 2: LỊCH THI ĐẤU & KẾT QUẢ */}
      {/* ======================================================== */}
      {publicTab === 'lichthidau' && (
        <section className="animate-fade-in">
          {/* Controls & Filter bar */}
          <div className="card mb16">
            <div className="grid-auto" style={{ alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tìm kiếm theo tên đội:</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="input-dark"
                    placeholder="Gõ tên đội..."
                    value={searchMatchTxt}
                    onChange={(e) => setSearchMatchTxt(e.target.value)}
                    style={{ paddingLeft: '34px' }}
                  />
                  <Search size={16} className="text-muted" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Lọc theo Bảng / Vòng:</label>
                <select
                  className="select-dark"
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                >
                  <option value="">-- Tất cả các bảng & vòng --</option>
                  {groupsData.map((g) => (
                    <option key={g.groupName} value={g.groupName}>
                      {g.groupName}
                    </option>
                  ))}
                  <option value="Vòng Knock-out">Vòng Knock-out</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`btn small ${scheduleSubTab === 'upcoming' ? 'green' : 'ghost'}`}
                  onClick={() => setScheduleSubTab('upcoming')}
                  style={{ flex: 1 }}
                >
                  <Clock size={14} /> Sắp Diễn Ra ({upcomingMatches.length})
                </button>
                <button
                  className={`btn small ${scheduleSubTab === 'completed' ? 'green' : 'ghost'}`}
                  onClick={() => setScheduleSubTab('completed')}
                  style={{ flex: 1 }}
                >
                  <CheckCircle2 size={14} /> Kết Quả ({completedMatches.length})
                </button>
              </div>
            </div>
          </div>

          {/* Matches List */}
          {scheduleSubTab === 'upcoming' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Clock size={18} className="text-accent" />
                  <span>Lịch Thi Đấu Sắp Tới</span>
                </div>
                <span className="badge badge-ghost">{upcomingMatches.length} trận</span>
              </div>

              {upcomingMatches.length === 0 ? (
                <div className="empty-state-card">Không có trận đấu sắp tới nào phù hợp.</div>
              ) : (
                <div className="table-container">
                  <table className="dpl-table">
                    <thead>
                      <tr>
                        <th>Vòng / Bảng</th>
                        <th>Cặp Đấu</th>
                        <th>Ngày & Giờ</th>
                        <th>Trọng Tài</th>
                        <th>Chi Tiết</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingMatches.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <span className="badge badge-ghost">{m.round || m.group}</span>
                          </td>
                          <td>
                            <span style={{ fontWeight: '700', fontSize: '14.5px' }}>
                              {m.home} <span className="text-dim" style={{ margin: '0 4px' }}>vs</span> {m.away}
                            </span>
                          </td>
                          <td className="text-accent font-bold">
                            {formatDateTime(m.date)}
                          </td>
                          <td className="text-dim">{m.ref || 'Chưa phân công'}</td>
                          <td>
                            <button
                              className="btn ghost tiny"
                              onClick={() => setViewingMatch(m)}
                            >
                              <Eye size={12} /> Xem
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {scheduleSubTab === 'completed' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <CheckCircle2 size={18} className="text-accent" />
                  <span>Kết Quả Các Trận Đã Đấu</span>
                </div>
                <span className="badge badge-done">{completedMatches.length} trận đã xong</span>
              </div>

              {completedMatches.length === 0 ? (
                <div className="empty-state-card">Chưa có kết quả trận đấu nào.</div>
              ) : (
                <div className="table-container">
                  <table className="dpl-table">
                    <thead>
                      <tr>
                        <th>Vòng / Bảng</th>
                        <th>Cặp Đấu</th>
                        <th style={{ textAlign: 'center' }}>Tỉ Số</th>
                        <th>Ngày Đấu</th>
                        <th>Hành Động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedMatches.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <span className="badge badge-ghost">{m.round || m.group}</span>
                          </td>
                          <td>
                            <span style={{ fontWeight: '700' }}>
                              {m.home} vs {m.away}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#080D14', padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                              <span style={{ fontWeight: '900', color: 'var(--accent-green)', fontSize: '15px' }}>
                                {m.scoreA} - {m.scoreB}
                              </span>
                              {m.penA !== undefined && m.penA !== '' && (
                                <span style={{ fontSize: '11px', color: 'var(--accent-gold)' }}>
                                  (Pen: {m.penA}-{m.penB})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-dim">{formatDateTime(m.date)}</td>
                          <td>
                            <button
                              className="btn ghost tiny"
                              onClick={() => setViewingMatch(m)}
                            >
                              <Eye size={12} /> Biên bản
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* TAB 3: SƠ ĐỒ NHÁNH KNOCK-OUT */}
      {/* ======================================================== */}
      {publicTab === 'knockout' && (
        <section className="animate-fade-in">
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Trophy size={18} className="text-gold" />
                <span>Sơ Đồ Vòng Đấu Loại Trực Tiếp (Knock-out)</span>
              </div>
              <span className="text-dim" style={{ fontSize: '12px' }}>
                Bấm vào từng trận để xem biên bản chi tiết
              </span>
            </div>

            <KnockoutBracket
              matches={matches}
              onSelectMatch={(m) => setViewingMatch(m)}
            />
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* TAB 4: THỐNG KÊ (VUA PHÁ LƯỚI & THẺ PHẠT) */}
      {/* ======================================================== */}
      {publicTab === 'thongke' && (
        <section className="animate-fade-in grid-2">
          {/* Top Scorers */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <span style={{ fontSize: '20px' }}>👟</span>
                <span>Vua Phá Lưới (Golden Boot)</span>
              </div>
              <span className="badge badge-pending">Nhấn xem chi tiết</span>
            </div>

            {topScorers.length === 0 ? (
              <div className="empty-state-card">Chưa có bàn thắng nào được ghi.</div>
            ) : (
              <div>
                <div className="text-dim mb10" style={{ fontSize: '11.5px', fontStyle: 'italic' }}>
                  💡 Nhấn vào cầu thủ để xem danh sách các trận đã ghi bàn & tỉ số trận đấu:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {topScorers.map((s, idx) => (
                    <div
                      key={s.key}
                      className="stat-clickable-row"
                      onClick={() => setViewingPlayerStats({ type: 'goals', data: s })}
                      title="Nhấn để xem chi tiết các trận ghi bàn"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: idx === 0 ? 'rgba(245,158,11,0.08)' : 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                        border: idx === 0 ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--border-subtle)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '28px', textAlign: 'center', fontWeight: '900', fontSize: '16px' }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </div>

                        {s.avatar ? (
                          <img
                            src={s.avatar}
                            alt={s.displayName}
                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-card)' }}
                          />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-card-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-card)' }}>
                            <Users size={16} className="text-dim" />
                          </div>
                        )}

                        <div>
                          <div style={{ fontWeight: '700', fontSize: '14px', color: '#FFFFFF' }}>{s.displayName}</div>
                          <div className="text-dim" style={{ fontSize: '11px' }}>{s.team}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--accent-gold)' }}>
                            {s.goals}
                          </span>
                          <span style={{ fontSize: '14px' }}>⚽</span>
                        </div>
                        <span className="badge tiny badge-ghost" style={{ fontSize: '10px' }}>Chi tiết ➔</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Discipline / Fair-play */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <span style={{ fontSize: '20px' }}>🚨</span>
                <span>Bảng Thống Kê Thẻ Phạt</span>
              </div>
              <span className="badge badge-danger">Nhấn xem chi tiết</span>
            </div>

            {topCards.length === 0 ? (
              <div className="empty-state-card">
                <p>Giải đấu hiện rất Fair-play, chưa có thẻ phạt nào!</p>
              </div>
            ) : (
              <div>
                <div className="text-dim mb10" style={{ fontSize: '11.5px', fontStyle: 'italic' }}>
                  💡 Nhấn vào cầu thủ để xem danh sách các trận đã nhận thẻ & lý do phạt:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {topCards.map((c, idx) => (
                    <div
                      key={c.key}
                      className="stat-clickable-row card-row"
                      onClick={() => setViewingPlayerStats({ type: 'cards', data: c })}
                      title="Nhấn để xem chi tiết các trận nhận thẻ"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="text-dim" style={{ width: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                          #{idx + 1}
                        </span>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#FFFFFF' }}>{c.displayName}</div>
                          <div className="text-dim" style={{ fontSize: '11px' }}>{c.team}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {c.yellow > 0 && (
                          <span style={{ background: 'var(--accent-gold)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '800' }}>
                            {c.yellow} 🟨
                          </span>
                        )}
                        {c.red > 0 && (
                          <span style={{ background: 'var(--accent-red)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '800' }}>
                            {c.red} 🟥
                          </span>
                        )}
                        <span className="badge tiny badge-ghost" style={{ fontSize: '10px' }}>Chi tiết ➔</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* TAB 5: ĐỘI HÌNH & CẦU THỦ */}
      {/* ======================================================== */}
      {publicTab === 'doihinh' && (
        <section className="animate-fade-in">
          <div className="card mb16">
            <div className="form-group" style={{ maxWidth: '360px', marginBottom: 0 }}>
              <label className="form-label">Chọn Đội Bóng Để Xem Đội Hình:</label>
              <select
                className="select-dark"
                value={activeTeamRoster}
                onChange={(e) => setSelectedTeamRoster(e.target.value)}
              >
                {allTeamsList.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Shield size={20} className="text-accent" />
                <span>Danh Sách Đội Hình: {activeTeamRoster}</span>
              </div>
              <span className="badge badge-accent-glow">
                {currentRosterPlayers.length} Cầu Thủ Đăng Ký
              </span>
            </div>

            {currentRosterPlayers.length === 0 ? (
              <div className="empty-state-card">
                Đội này chưa cập nhật danh sách cầu thủ.
              </div>
            ) : (
              <div className="grid-auto">
                {currentRosterPlayers.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px'
                    }}
                  >
                    {p.avatar ? (
                      <img
                        src={p.avatar}
                        alt={p.name}
                        style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-green)' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: 'var(--bg-card-alt)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid var(--border-card)',
                          fontSize: '18px',
                          fontWeight: 'bold',
                          color: 'var(--accent-green)'
                        }}
                      >
                        #{p.num}
                      </div>
                    )}

                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: '11px', color: 'var(--accent-green)', fontWeight: 'bold' }}>
                        ÁO SỐ #{p.num}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </div>
                      {p.shirtName && (
                        <div className="text-dim" style={{ fontSize: '12px' }}>
                          Tên áo: <b>{p.shirtName}</b>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
