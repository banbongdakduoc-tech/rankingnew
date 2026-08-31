// src/components/MatchPrintReport.jsx
import { Printer, ArrowLeft } from 'lucide-react';
import { formatDateTime, cleanPlayerName } from '../services/tournamentService';

export default function MatchPrintReport({
  match,
  tourConfig = {},
  onBack
}) {
  if (!match) return null;

  const handlePrint = () => {
    window.print();
  };

  const events = (match.events || []).slice().sort((a, b) => Number(a.minute) - Number(b.minute));
  const goalEvents = events.filter((e) => e.type === 'goal');
  const cardEvents = events.filter((e) => e.type === 'card');

  return (
    <div className="print-page-wrapper">
      {/* Control bar (Hidden during print) */}
      <div className="print-control-bar no-print">
        <button type="button" className="btn ghost small" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Quay lại giao diện</span>
        </button>
        <button type="button" className="btn green small" onClick={handlePrint}>
          <Printer size={16} />
          <span>In Biên Bản Ngay</span>
        </button>
      </div>

      {/* Official Match Document A4 */}
      <div className="official-document">
        {/* Header */}
        <div className="doc-header">
          <div className="doc-org-info">
            <div className="doc-org-name">CÂU LẠC BỘ THỂ THAO TRƯỜNG DƯỢC</div>
            <div className="doc-suborg">BAN TỔ CHỨC GIẢI ĐẤU</div>
          </div>
          <div className="doc-national-info">
            <div className="doc-national-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div className="doc-national-motto">Độc lập - Tự do - Hạnh phúc</div>
          </div>
        </div>

        <div className="doc-divider"></div>

        <div className="doc-main-title">
          <h2>BIÊN BẢN TRẬN ĐẤU BÓNG ĐÁ</h2>
          <div className="doc-tour-name">
            GIẢI ĐẤU: {tourConfig.name ? tourConfig.name.toUpperCase() : 'DƯỢC PREMIER LEAGUE 2026'}
          </div>
          <div className="doc-round-name">
            VÒNG: {match.round ? match.round.toUpperCase() : match.group ? match.group.toUpperCase() : 'VÒNG BẢNG'}
          </div>
        </div>

        {/* Match General Info Table */}
        <table className="doc-table doc-info-table">
          <tbody>
            <tr>
              <td style={{ width: '20%' }}><b>Thời gian:</b></td>
              <td style={{ width: '30%' }}>{formatDateTime(match.date)}</td>
              <td style={{ width: '20%' }}><b>Địa điểm:</b></td>
              <td style={{ width: '30%' }}>Sân bóng Trường Dược</td>
            </tr>
            <tr>
              <td><b>Trọng tài chính:</b></td>
              <td>{match.ref || '........................'}</td>
              <td><b>Thư ký ghi chép:</b></td>
              <td>{match.sec || '........................'}</td>
            </tr>
          </tbody>
        </table>

        {/* Scoreboard Summary */}
        <div className="doc-score-banner">
          <div className="doc-score-team home">
            <div className="doc-team-label">ĐỘI NHÀ</div>
            <div className="doc-team-title">{match.home}</div>
          </div>
          <div className="doc-score-val">
            <span className="val">{match.scoreA ?? 0}</span>
            <span className="div">-</span>
            <span className="val">{match.scoreB ?? 0}</span>
          </div>
          <div className="doc-score-team away">
            <div className="doc-team-label">ĐỘI KHÁCH</div>
            <div className="doc-team-title">{match.away}</div>
          </div>
        </div>

        {match.penA !== undefined && match.penA !== '' && (
          <div className="doc-pen-note">
            Tỉ số Luân lưu (Penalty Shootout): <b>{match.home} ({match.penA}) - ({match.penB}) {match.away}</b>
            {match.advancingTeam && ` - Đội giành quyền đi tiếp: ${match.advancingTeam}`}
          </div>
        )}

        {/* 1. Goals Table */}
        <div className="doc-section-heading">1. DANH SÁCH BÀN THẮNG</div>
        <table className="doc-table">
          <thead>
            <tr>
              <th style={{ width: '10%' }}>Phút</th>
              <th style={{ width: '40%' }}>Cầu thủ ghi bàn</th>
              <th style={{ width: '30%' }}>Đội bóng</th>
              <th style={{ width: '20%' }}>Hình thức</th>
            </tr>
          </thead>
          <tbody>
            {goalEvents.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center italic">Không có bàn thắng nào trong trận đấu</td>
              </tr>
            ) : (
              goalEvents.map((e, idx) => (
                <tr key={idx}>
                  <td className="text-center font-bold">{e.displayMinute || `${e.minute}'`}</td>
                  <td>{cleanPlayerName(e.player)}</td>
                  <td>{e.team}</td>
                  <td>
                    {e.detail === 'own' ? 'Phản lưới nhà (OG)' : e.detail === 'pen' ? 'Phạt đền (Penalty)' : 'Bàn thắng thường'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 2. Cards Table */}
        <div className="doc-section-heading">2. DANH SÁCH THẺ PHẠT</div>
        <table className="doc-table">
          <thead>
            <tr>
              <th style={{ width: '10%' }}>Phút</th>
              <th style={{ width: '40%' }}>Cầu thủ bị phạt</th>
              <th style={{ width: '30%' }}>Đội bóng</th>
              <th style={{ width: '20%' }}>Loại thẻ</th>
            </tr>
          </thead>
          <tbody>
            {cardEvents.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center italic">Trận đấu không có thẻ phạt (Fair-play)</td>
              </tr>
            ) : (
              cardEvents.map((e, idx) => (
                <tr key={idx}>
                  <td className="text-center font-bold">{e.displayMinute || `${e.minute}'`}</td>
                  <td>{cleanPlayerName(e.player)}</td>
                  <td>{e.team}</td>
                  <td className="text-center font-bold">
                    {e.detail === 'Đỏ' || e.detail === 'red' ? 'THẺ ĐỎ 🟥' : 'THẺ VÀNG 🟨'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 3. Lineup Lists */}
        <div className="doc-section-heading">3. DANH SÁCH CẦU THỦ THI ĐẤU</div>
        <div className="doc-rosters-grid">
          <div className="doc-roster-box">
            <div className="doc-roster-title">{match.home}</div>
            <table className="doc-table doc-small-table">
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>Số áo</th>
                  <th>Họ và tên cầu thủ</th>
                </tr>
              </thead>
              <tbody>
                {(match.lineupA || []).filter(p => p.played).length === 0 ? (
                  <tr><td colSpan="2" className="text-center italic">Chưa điểm danh</td></tr>
                ) : (
                  (match.lineupA || []).filter(p => p.played).map((p, i) => (
                    <tr key={i}>
                      <td className="text-center font-bold">{p.num}</td>
                      <td>{p.name} {p.shirtName ? `(${p.shirtName})` : ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="doc-roster-box">
            <div className="doc-roster-title">{match.away}</div>
            <table className="doc-table doc-small-table">
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>Số áo</th>
                  <th>Họ và tên cầu thủ</th>
                </tr>
              </thead>
              <tbody>
                {(match.lineupB || []).filter(p => p.played).length === 0 ? (
                  <tr><td colSpan="2" className="text-center italic">Chưa điểm danh</td></tr>
                ) : (
                  (match.lineupB || []).filter(p => p.played).map((p, i) => (
                    <tr key={i}>
                      <td className="text-center font-bold">{p.num}</td>
                      <td>{p.name} {p.shirtName ? `(${p.shirtName})` : ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Secretary Note if any */}
        {match.secretaryNote && (
          <div style={{ marginTop: '16px', padding: '10px 14px', border: '1px solid #999', borderRadius: '4px', fontSize: '12px' }}>
            <b>Ý kiến / Ghi chú của Thư ký:</b> <i>"{match.secretaryNote}"</i>
          </div>
        )}

        {/* Signatures Section */}
        <div className="doc-signatures-section">
          <div className="doc-sig-col">
            <div className="doc-sig-role">ĐỘI TRƯỞNG {match.home}</div>
            <div className="doc-sig-sub">(Ký và ghi rõ họ tên)</div>
            <div className="doc-sig-box">
              {match.signatures && match.signatures.home ? (
                <img src={match.signatures.home} alt="Ký tên đội nhà" className="doc-sig-img" />
              ) : (
                <div className="doc-sig-line"></div>
              )}
            </div>
          </div>

          <div className="doc-sig-col">
            <div className="doc-sig-role">ĐỘI TRƯỞNG {match.away}</div>
            <div className="doc-sig-sub">(Ký và ghi rõ họ tên)</div>
            <div className="doc-sig-box">
              {match.signatures && match.signatures.away ? (
                <img src={match.signatures.away} alt="Ký tên đội khách" className="doc-sig-img" />
              ) : (
                <div className="doc-sig-line"></div>
              )}
            </div>
          </div>

          <div className="doc-sig-col">
            <div className="doc-sig-role">TRỌNG TÀI CHÍNH</div>
            <div className="doc-sig-sub">(Ký và ghi rõ họ tên)</div>
            <div className="doc-sig-box">
              {match.signatures && match.signatures.referee ? (
                <img src={match.signatures.referee} alt="Ký tên trọng tài" className="doc-sig-img" />
              ) : (
                <div className="doc-sig-line"></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
