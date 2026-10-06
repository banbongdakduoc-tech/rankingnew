import { askText } from '../services/promptService';
// src/pages/RefereeDashboard.jsx
import { useState, useEffect, useRef } from 'react';
import { ref, onValue, update } from '../services/dataService';
import { db, syncSnapshot, sendCommand, flushQueue } from '../services/dataService';
import { readDraft, saveDraft, clearDraft } from '../services/drafts';
import ShootoutPanel from '../components/ShootoutPanel';
import {
  FileText,
  Search,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Coffee,
  RotateCcw,
  CheckSquare,
  Shield,
  Clock,
  ArrowRight,
  ArrowLeft,
  Calendar,
  User,
  Plus,
  Trash2,
  Send,
  XCircle,
  MessageSquare,
  UserPlus,
  Printer
} from 'lucide-react';
import SignatureCanvas from '../components/SignatureCanvas';
import MatchPrintReport from '../components/MatchPrintReport';
import { useToast } from '../components/ToastContext';
import {
  shootoutSummary,
  numberMatchesBySchedule,
  formatDateTime,
  cleanPlayerName,
  calculateEventsGoals,
  formatMatchMinute,
  formatSecondsToMMSS, parseMatchMinute, compareEvents, mergeMatchDraft, elapsedClock, normalizeKickoff, kickoffInput
} from '../services/tournamentService';

export default function RefereeDashboard() {
  const toast = useToast();
  const [savedDraft] = useState(() => readDraft());
  const [clock, setClock] = useState(() => savedDraft?.clock || { elapsed: 0, running: false, period: 1 });
  const [innerTab, setInnerTab] = useState('bienban'); // 'bienban' | 'thongtin'

  // ==========================================
  // 1. STATE ĐỒNG BỘ TỪ FIREBASE
  // ==========================================
  const [tourStatus, setTourStatus] = useState('none');
  const [tourConfig, setTourConfig] = useState({ halfDuration: 20 });
  const [allMatches, setAllMatches] = useState([]);
  const [allPlayers, setAllPlayers] = useState({});
  const [suspensions, setSuspensions] = useState({});
  const [printingMatch, setPrintingMatch] = useState(null);

  useEffect(() => {
    const unsubscribe0 = onValue(ref(db, 'tourStatus'), (snap) => setTourStatus(snap.val() || 'none'));
    const unsubscribe1 = onValue(ref(db, 'tourConfig'), (snap) => {
      if (snap.exists()) setTourConfig(snap.val());
    });
    const unsubscribe2 = onValue(ref(db, 'matches'), (snap) => {
      const data = snap.val();
      setAllMatches(data ? Object.keys(data).map((k) => ({ id: k, ...data[k] })) : []);
    });
    const unsubscribe3 = onValue(ref(db, 'players'), (snap) => setAllPlayers(snap.val() || {}));
    const unsubscribe4 = onValue(ref(db, 'suspensions'), (snap) => setSuspensions(snap.val() || {}));

    return () => { unsubscribe0(); unsubscribe1(); unsubscribe2(); unsubscribe3(); unsubscribe4(); };
}, []);

  // ==========================================
  // 2. STATE QUY TRÌNH LẬP BIÊN BẢN (5 BƯỚC)
  // ==========================================
  const [step, setStep] = useState(savedDraft?.step || 1);
  const [selectedMatch, setSelectedMatch] = useState(savedDraft?.selectedMatch || null);

  // Step 2 Info
  const [matchDate, setMatchDate] = useState(kickoffInput(savedDraft?.matchDate));
  const [refereeName, setRefereeName] = useState(savedDraft?.refereeName ?? '');
  const [secretaryName, setSecretaryName] = useState(savedDraft?.secretaryName ?? '');

  // Step 3 Lineups
  const [lineupA, setLineupA] = useState(savedDraft?.lineupA ?? []);
  const [lineupB, setLineupB] = useState(savedDraft?.lineupB ?? []);
  const [quickAddA, setQuickAddA] = useState({ num: '', name: '', shirtName: '' });
  const [quickAddB, setQuickAddB] = useState({ num: '', name: '', shirtName: '' });

  // Step 4 Live Events, Score & Realtime Timer
  const [events, setEvents] = useState(savedDraft?.events ?? []);
  const {penA,penB} = shootoutSummary(selectedMatch || {},tourConfig.shootoutRounds || 5);


  // Realtime Timer Clock States
  const halfDuration = Number(tourConfig.halfDuration) || 20; // Số phút 1 hiệp do BTC set
  const [timerSeconds, setTimerSeconds] = useState(() => elapsedClock(savedDraft?.clock || {}));
  const [isTimerRunning, setIsTimerRunning] = useState(savedDraft?.clock?.running || false);
  const [matchPeriod, setMatchPeriod] = useState(savedDraft?.clock?.period ?? 1); // 1: Hiệp 1, 0: Nghỉ giữa hiệp, 2: Hiệp 2

  // Event Input Form
  const [eventType, setEventType] = useState('goal'); // 'goal' | 'card'
  const [evPhase, setEvPhase] = useState('play');
  const [evDetail, setEvDetail] = useState('normal'); // 'normal', 'own', 'pen', 'Vàng', 'Đỏ'
  const [evTeam, setEvTeam] = useState('');
  const [evPlayer, setEvPlayer] = useState('');
  const [customMin, setCustomMin] = useState(''); // Có thể để trống để auto lấy theo đồng hồ

  // Step 5 Signatures & Notes
  const [secretaryNote, setSecretaryNote] = useState(savedDraft?.secretaryNote ?? '');
  const sigRefA = useRef(null);
  const sigRefB = useRef(null);
  const sigRefReferee = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const eventSaving = useRef(false);
  const [savingEvent, setSavingEvent] = useState(false);

  // Filters for Schedule & Directory
  const [scheduleFilter, setScheduleFilter] = useState('');
  const [searchScheduleTxt, setSearchScheduleTxt] = useState('');
  const [searchPlayerTxt, setSearchPlayerTxt] = useState('');
  const [searchTeamFilter, setSearchTeamFilter] = useState('');

  // ==========================================
  // 3. REALTIME TIMER ENGINE
  // ==========================================
  useEffect(() => {
    const interval = setInterval(() => setTimerSeconds(elapsedClock(clock)), 500);
    return () => clearInterval(interval);
  }, [clock]);
  useEffect(() => {
    if (!selectedMatch) return;
    try { saveDraft({ selectedMatch, step, matchDate, refereeName, secretaryName, lineupA, lineupB, events, penA, penB, secretaryNote, clock }); }
    catch { toast.error('Không lưu được nháp trên máy. Kiểm tra dung lượng trước khi tiếp tục.'); }
  }, [selectedMatch, step, matchDate, refereeName, secretaryName, lineupA, lineupB, events, penA, penB, secretaryNote, clock, toast]);
  useEffect(() => {
    if (!selectedMatch?.id) return;
    return onValue(ref(db, `matches/${selectedMatch.id}`), snap => {
      const current = snap.val();
      if (!current) return;
      if (syncSnapshot().pending || syncSnapshot().conflicts.length) return;
      setSelectedMatch(previous => mergeMatchDraft(previous,current));
      setEvents((current.events || []).filter(e => !e.cancelled));

      if (current.clock) { setClock(current.clock); setMatchPeriod(current.clock.period); setIsTimerRunning(current.clock.running); }
    });
  }, [selectedMatch?.id]);
  const persistClock = async (next) => {
    try {

    setClock(next); setMatchPeriod(next.period); setIsTimerRunning(next.running); setTimerSeconds(elapsedClock(next));
    await update(ref(db, `matches/${selectedMatch.id}`), { clock: next });

    } catch (error) { toast.error(error.message || "Không lưu được dữ liệu."); }
};

  // Phút thi đấu hiện tại theo đồng hồ (có tính bù giờ +)
  const currentMatchTimeInfo = formatMatchMinute(timerSeconds, halfDuration, matchPeriod || 1, Number(tourConfig.extraTimeMinutes || 0));

  // ==========================================
  // 4. LOGIC XỬ LÝ QUY TRÌNH
  // ==========================================
  const handleSelectMatch = (match) => {
    setSelectedMatch(match);
    setMatchDate(kickoffInput(match.date));
    setRefereeName(match.ref || '');
    setSecretaryName(match.sec || '');

    const teamAPlayers = allPlayers[match.home] || [];
    const teamBPlayers = allPlayers[match.away] || [];

    setLineupA(
      match.lineupA && match.lineupA.length > 0
        ? match.lineupA
        : teamAPlayers.map((p) => ({ ...p, played: false }))
    );
    setLineupB(
      match.lineupB && match.lineupB.length > 0
        ? match.lineupB
        : teamBPlayers.map((p) => ({ ...p, played: false }))
    );

    setEvents((match.events || []).filter(e => !e.cancelled));
    const restoredClock = match.clock || { elapsed: 0, running: false, period: 1 };
    setClock(restoredClock); setTimerSeconds(elapsedClock(restoredClock)); setMatchPeriod(restoredClock.period); setIsTimerRunning(restoredClock.running);


    setSecretaryNote(match.secretaryNote || '');

    // Nếu trận đang LIVE hoặc bị từ chối -> nhảy ngay đến bước 4 để tiếp tục
    if (match.status === 'Đang LIVE' || match.status === 'Bị từ chối') {
      setStep(4);
      setIsTimerRunning(restoredClock.running);
    } else {
      setStep(2);
      setTimerSeconds(0);
      setIsTimerRunning(false);
      setMatchPeriod(1);
    }
  };

  const handleCancelMatch = () => {
    if (window.confirm('Bạn muốn hủy phiên làm việc hiện tại và quay về danh sách trận?')) {
      setSelectedMatch(null);
      setIsTimerRunning(false);
      setStep(1);
    }
  };

  const handleConfirmMatchInfo = async () => {
    try {

    if (!matchDate || !refereeName || !secretaryName) {
      toast.warning('Vui lòng điền đầy đủ Ngày giờ, Tên Trọng tài và Thư ký!');
      return;
    }

    await update(ref(db, `matches/${selectedMatch.id}`), {
      date: normalizeKickoff(matchDate),
      ref: refereeName,
      sec: secretaryName
    });

    toast.success('Đã lưu thông tin trận đấu!');
    setStep(3);

    } catch (error) { toast.error(error.message || "Không lưu được dữ liệu."); }
};

  const togglePlayerAttendance = (side, index) => {
    if (side === 'A') {
      const updated = [...lineupA];
      updated[index].played = !updated[index].played;
      setLineupA(updated);
    } else {
      const updated = [...lineupB];
      updated[index].played = !updated[index].played;
      setLineupB(updated);
    }
  };

  // Thêm nhanh cầu thủ vào đội hình tại Bước 3
  const handleQuickAddPlayer = () => toast.warning('Cầu thủ mới cần BTC kiểm tra và bổ sung vào danh sách chính thức.');

  const handleStartMatch = async () => {
    try {

    await update(ref(db, `matches/${selectedMatch.id}`), {
      status: 'Đang LIVE',
      lineupA,
      lineupB,
      clock: { elapsed: 0, running: true, startedAt: Date.now(), period: 1 }
    });

    setClock({ elapsed: 0, running: true, startedAt: Date.now(), period: 1 });
    // Bắt đầu bấm giờ realtime
    setTimerSeconds(0);
    setIsTimerRunning(true);
    setMatchPeriod(1);

    toast.info('Trận đấu đã chính thức bắt đầu (Hiệp 1)! Đồng hồ đang chạy realtime.');
    setStep(4);

    } catch (error) { toast.error(error.message || "Không lưu được dữ liệu."); }
};

  // Đồng hồ: Tạm dừng / Tiếp tục
  const handleToggleTimer = async () => {
    try {

    await persistClock({ elapsed: elapsedClock(clock), startedAt: Date.now(), running: !clock.running, period: clock.period });
    toast.info(clock.running ? 'Đã tạm dừng đồng hồ' : 'Đồng hồ tiếp tục chạy');

    } catch (error) { toast.error(error.message || "Không lưu được dữ liệu."); }
};
  const handleEndFirstHalf = async () => {
    try {
 await persistClock({ elapsed: elapsedClock(clock), startedAt: Date.now(), running: false, period: 0 });
    } catch (error) { toast.error(error.message || "Không lưu được dữ liệu."); }
};
  const handleStartSecondHalf = async () => {
    try {
 await persistClock({ elapsed: halfDuration * 60, startedAt: Date.now(), running: true, period: 2 });
    } catch (error) { toast.error(error.message || "Không lưu được dữ liệu."); }
};
  const handleResetTimer = async () => {
    try {

    const value = await askText('Chỉnh phút (ví dụ 12, 20+2, 40+1). Chọn đúng hiệp hiện tại:', currentMatchTimeInfo.displayMinute);
    if (value === null) return;
    const parsed = parseMatchMinute(value, matchPeriod || 1);
    await persistClock({ elapsed: (parsed.minute + parsed.addedMinute) * 60, startedAt: Date.now(), running: clock.running, period: matchPeriod || 1 });

    } catch (error) { toast.error(error.message || "Không lưu được dữ liệu."); }
};

  // ==========================================
  // THÊM SỰ KIỆN: NHẢY SỐ LIỀN 0ms DELAY
  // ==========================================
  const handleAddEvent = async () => {
    if (eventSaving.current) return;
    eventSaving.current = true; setSavingEvent(true);
    try {

    if (!evTeam || !evPlayer) {
      toast.warning('Vui lòng chọn Đội và Cầu thủ!');
      return;
    }

    const parsed = customMin?.trim() ? parseMatchMinute(customMin, matchPeriod || 1) : parseMatchMinute(currentMatchTimeInfo.displayMinute, matchPeriod || 1);
    const player = (allPlayers[evTeam] || []).find(p => `${p.num} - ${p.name}` === evPlayer);
    if (!player) throw new Error('Không tìm thấy cầu thủ.');
    const newEv = { id: crypto.randomUUID(), type: eventType, detail: evDetail, phase:eventType==='card'?evPhase:'play', team: evTeam, player: evPlayer, playerId: player.id, ...parsed, sequence: Date.now() };
    const finalDisplayMinute = parsed.displayMinute;
    const newEvents = [...events, newEv].sort(compareEvents);

    // Tính toán ngay tỉ số chuẩn
    const { goalsA, goalsB } = calculateEventsGoals(newEvents, selectedMatch.home, selectedMatch.away);

    const result = await sendCommand({ kind: 'events', matchId: selectedMatch.id, baseVersion: selectedMatch.version || 0, add: [newEv], remove: [] }, { offline: true });

    // Cập nhật State cục bộ NGAY LẬP TỨC (0ms latency - nhảy số liền!)
    setEvents(newEvents);
    setSelectedMatch((prev) => ({
      ...prev,
      events: newEvents,
      scoreA: goalsA,
      scoreB: goalsB
    }));

    // Đồng bộ lên Firebase Realtime Database

    toast.success(result.queued ? 'Đã lưu sự kiện trên máy · Chờ đồng bộ' : `Đã xác nhận sự kiện ${finalDisplayMinute} · ${goalsA}–${goalsB}`);

    // Reset form
    setEvPhase('play');
    setEventType('goal');
    setEvDetail('normal');
    setEvTeam('');
    setEvPlayer('');
    setCustomMin('');

    } catch (error) { toast.error(error.message || "Không lưu được dữ liệu."); } finally { eventSaving.current = false; setSavingEvent(false); }
};

  const handleRemoveEvent = async (id) => {
    try {

    const reason = await askText('Lý do hủy sự kiện:', 'Ghi nhầm');
    if (!reason?.trim()) return;
    const result = await sendCommand({ kind: 'events', matchId: selectedMatch.id, baseVersion: selectedMatch.version || 0, add: [], remove: [id], reason }, { offline: true });
    const next = events.filter(e => e.id !== id), score = calculateEventsGoals(next, selectedMatch.home, selectedMatch.away);
    setEvents(next); setSelectedMatch(prev => ({ ...prev, events: next, scoreA: score.goalsA, scoreB: score.goalsB }));
    toast.info(result.queued ? 'Đã lưu yêu cầu hủy trên máy' : 'Đã hủy sự kiện và cập nhật tỷ số');

    } catch (error) { toast.error(error.message || "Không lưu được dữ liệu."); }
};

  const startExtraPeriod = async period => {
    if(!window.confirm(`Bắt đầu hiệp phụ ${period===3?1:2}?`))return;
    await persistClock({elapsed:(halfDuration*2+(period===4?Number(tourConfig.extraTimeMinutes):0))*60,running:true,period,startedAt:Date.now()});
  };
  const handleEndMatch = async () => {
    try {

    if (window.confirm('Xác nhận KẾT THÚC TRẬN ĐẤU? Hệ thống sẽ chuyển sang phần kiểm tra biên bản và ký tên điện tử.')) {
      await persistClock({ elapsed: elapsedClock(clock), running: false, period: matchPeriod, startedAt: Date.now() });
      setStep(5);
    }

    } catch (error) { toast.error(error.message || "Không lưu được dữ liệu."); }
};

  // Nộp biên bản Bước 5
  const handleSubmitReport = async () => {
    setIsSubmitting(true);
    try {
      await flushQueue();
      const sync=syncSnapshot();
      if(sync.conflicts.length)throw new Error(`Có ${sync.conflicts.length} thao tác xung đột. Mở chấm trạng thái cuối trang để đối chiếu trước khi nộp.`);
      if(sync.pending)throw new Error(`Còn ${sync.pending} thao tác chưa gửi. Kiểm tra kết nối và thử nộp lại.`);
      const sigA = sigRefA.current ? sigRefA.current.getDataUrl() : '';
      const sigB = sigRefB.current ? sigRefB.current.getDataUrl() : '';
      const sigRef = sigRefReferee.current ? sigRefReferee.current.getDataUrl() : '';

      if (![sigA, sigB, sigRef].every(Boolean)) throw new Error('Cần đủ chữ ký hai đội trưởng và trọng tài trước khi nộp.');
      const signatures = {
        home: sigA || selectedMatch.signatures?.home || '',
        away: sigB || selectedMatch.signatures?.away || '',
        referee: sigRef || selectedMatch.signatures?.referee || '',
        submittedAt: new Date().toISOString()
      };

      await update(ref(db, `matches/${selectedMatch.id}`), {
        status: 'Chờ duyệt',
        signatures,
        lineupA, lineupB,
        secretaryNote: secretaryNote.trim(),
        rejectReason: ''
      });

      toast.success('✅ Đã nộp Biên bản thành công! Đang chờ Ban Tổ Chức duyệt.');
      setSelectedMatch(null); clearDraft();
      setStep(1);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Có lỗi xảy ra khi nộp biên bản!');
    }
    setIsSubmitting(false);
  };

  // ==========================================
  // DATA LỌC & DANH BẠ
  // ==========================================
  const uniqueGroups = [...new Set(allMatches.map((m) => m.group))];
  const filteredMatches = numberMatchesBySchedule(allMatches)
    .filter(m => m.assignedSecretary === JSON.parse(localStorage.getItem('dpl_user') || '{}').username || JSON.parse(localStorage.getItem('dpl_user') || '{}').role === 'admin')
    .filter((m) => !scheduleFilter || m.group === scheduleFilter)
    .filter((m) => !searchScheduleTxt || m.home?.toLowerCase().includes(searchScheduleTxt.toLowerCase()) || m.away?.toLowerCase().includes(searchScheduleTxt.toLowerCase()));

  let flatPlayers = [];
  Object.keys(allPlayers).forEach((tName) => {
    (allPlayers[tName] || []).forEach((p) => {
      flatPlayers.push({ ...p, teamName: tName });
    });
  });

  const filteredPlayers = flatPlayers.filter((p) => {
    if (searchTeamFilter && p.teamName !== searchTeamFilter) return false;
    if (searchPlayerTxt) {
      const txt = searchPlayerTxt.toLowerCase();
      return (
        p.name?.toLowerCase().includes(txt) ||
        p.shirtName?.toLowerCase().includes(txt) ||
        p.num?.toString().includes(txt)
      );
    }
    return true;
  });

  // If in Print Mode, render full A4 report
  if (printingMatch) {
    return (
      <MatchPrintReport
        match={printingMatch}
        tourConfig={tourConfig}
        onBack={() => setPrintingMatch(null)}
      />
    );
  }

  if (tourStatus !== 'active' && tourStatus !== 'completed') {
    return (
      <div className="app-container">
        <div className="card text-center" style={{ padding: '60px 20px', maxWidth: '600px', margin: '40px auto' }}>
          <Clock size={36} className="text-accent mb16" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>Giải Đấu Chưa Khởi Tranh</h2>
          <p className="text-dim">
            Tổ Thư ký vui lòng chờ Ban Tổ Chức chốt lịch thi đấu chính thức để bắt đầu làm việc.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container animate-fade-in">
      {/* Top Tabs */}
      <div className="card mb16" style={{ padding: '8px 12px' }}>
        <div className="navbar-nav" style={{ background: 'transparent', border: 'none' }}>
          <button
            className={`nav-link ${innerTab === 'bienban' ? 'active' : ''}`}
            onClick={() => setInnerTab('bienban')}
          >
            <FileText size={16} />
            <span>📝 Lập Biên Bản Trận Đấu</span>
          </button>
          <button
            className={`nav-link ${innerTab === 'thongtin' ? 'active' : ''}`}
            onClick={() => setInnerTab('thongtin')}
          >
            <Search size={16} />
            <span>🔍 Tra Cứu Cầu Thủ</span>
          </button>
        </div>
      </div>

      {innerTab === 'bienban' && (
        <>
          {/* ======================================================== */}
          {/* BƯỚC 1: DANH SÁCH & CHỌN TRẬN ĐẤU */}
          {/* ======================================================== */}
          {step === 1 && (
            <div className="card animate-fade-in">
              <div className="card-header">
                <div className="card-title">
                  <Calendar size={18} className="text-accent" />
                  <span>1. Chọn Trận Đấu Để Ghi Biên Bản</span>
                </div>
                <span className="badge badge-accent-glow">Tổ Thư Ký</span>
              </div>

              {/* Filters */}
              <div className="grid-2 mb16">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Lọc theo Bảng / Vòng:</label>
                  <select
                    className="select-dark"
                    value={scheduleFilter}
                    onChange={(e) => setScheduleFilter(e.target.value)}
                  >
                    <option value="">-- Tất cả các bảng & vòng --</option>
                    {uniqueGroups.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tìm kiếm đội bóng:</label>
                  <input
                    type="text"
                    className="input-dark"
                    placeholder="Gõ tên đội..."
                    value={searchScheduleTxt}
                    onChange={(e) => setSearchScheduleTxt(e.target.value)}
                  />
                </div>
              </div>

              {/* Table */}
              <div className="table-container">
                <table className="dpl-table">
                  <thead>
                    <tr>
                      <th>STT trận</th>
                      <th>Cặp Đấu</th>
                      <th>Ngày Giờ</th>
                      <th>Trọng Tài</th>
                      <th>Trạng Thái</th>
                      <th>Hành Động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatches.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-dim" style={{ padding: '30px' }}>
                          Không tìm thấy trận đấu nào phù hợp.
                        </td>
                      </tr>
                    ) : null}
                    {filteredMatches.map((m) => {
                      const isLocked = m.status === 'Đã xong' || m.status === 'Chờ duyệt';
                      const isRejected = m.status === 'Bị từ chối';
                      const isLive = m.status === 'Đang LIVE';

                      return (
                        <tr key={m.id}>
                          <td>
                            <span className="badge badge-ghost">{m.matchNumber}</span>
                          </td>
                          <td style={{ fontWeight: '700' }}>
                            {m.home} <span className="text-dim">vs</span> {m.away}
                          </td>
                          <td className="text-dim">
                            {m.date ? formatDateTime(m.date) : 'Chưa xếp lịch'}
                          </td>
                          <td className="text-dim">{m.ref || '—'}</td>
                          <td>
                            {isRejected ? (
                              <span className="badge badge-danger">❌ Bị từ chối</span>
                            ) : isLive ? (
                              <span className="badge badge-live">🔴 Đang LIVE</span>
                            ) : m.status === 'Đã xong' ? (
                              <span className="badge badge-done">✅ Đã xong</span>
                            ) : m.status === 'Chờ duyệt' ? (
                              <span className="badge badge-pending">⏳ Chờ duyệt</span>
                            ) : (
                              <span className="badge badge-ghost">⚪ Sắp diễn ra</span>
                            )}
                          </td>
                          <td>
                            {isLocked ? (
                              <button
                                type="button"
                                className="btn ghost tiny"
                                onClick={() => setPrintingMatch(m)}
                                title="In biên bản trận đấu A4"
                                style={{ color: 'var(--accent-green)' }}
                              >
                                <Printer size={12} /> In Biên Bản
                              </button>
                            ) : isRejected || isLive ? (
                              <button
                                className="btn danger tiny"
                                onClick={() => handleSelectMatch(m)}
                              >
                                Tiếp tục / Sửa
                              </button>
                            ) : (
                              <button
                                className="btn green tiny"
                                onClick={() => handleSelectMatch(m)}
                              >
                                Làm việc ➔
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Header Thông tin trận đang chọn */}
          {selectedMatch && step > 1 && (
            <div className="card mb16" style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border-card)' }}>
              <div className="flex-between">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Shield size={22} className="text-accent" />
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800' }}>
                      {selectedMatch.home} <span className="text-accent">vs</span> {selectedMatch.away}
                    </h3>
                    <div className="text-dim" style={{ fontSize: '12px' }}>
                      {selectedMatch.round || selectedMatch.group} • Bước {step}/5
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn ghost small"
                  style={{ color: 'var(--accent-red)' }}
                  onClick={handleCancelMatch}
                >
                  <XCircle size={14} /> Hủy / Chọn Trận Khác
                </button>
              </div>

              {selectedMatch.status === 'Bị từ chối' && (
                <div style={{ marginTop: '14px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--accent-red)', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} /> BIÊN BẢN BỊ ADMIN TỪ CHỐI
                  </div>
                  <div style={{ color: '#FFFFFF', fontSize: '13.5px', marginTop: '4px' }}>
                    Lý do: <b>"{selectedMatch.rejectReason || 'Vui lòng kiểm tra lại sự kiện và tỉ số'}"</b>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* BƯỚC 2: CẬP NHẬT THÔNG TIN TRẬN ĐẤU & CẢNH BÁO TREO GIÒ */}
          {/* ======================================================== */}
          {step === 2 && selectedMatch && (
            <div className="card animate-fade-in">
              <div className="card-header">
                <div className="card-title">
                  <User size={18} className="text-accent" />
                  <span>Bước 2: Cập Nhật Thời Gian & Tổ Trọng Tài</span>
                </div>
                <span className="badge badge-ghost">Bước 2 / 5</span>
              </div>

              {/* Cảnh báo Cầu thủ bị treo giò */}
              {(() => {
                const bannedPlayers = Object.keys(suspensions)
                  .filter((key) => {
                    const team = key.split('@@')[0];
                    return team === selectedMatch.home || team === selectedMatch.away;
                  })
                  .map((key) => ({
                    team: key.split('@@')[0],
                    player: key.split('@@')[1],
                    reason: suspensions[key].reason
                  }));

                if (bannedPlayers.length === 0) return null;

                return (
                  <div className="mb16" style={{ padding: '14px 18px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ color: 'var(--accent-red)', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <AlertTriangle size={18} /> CẢNH BÁO: CẦU THỦ ĐANG BỊ TREO GIÒ (CẤM THI ĐẤU)
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#FFFFFF' }}>
                      {bannedPlayers.map((bp, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>
                          <b>{bp.player}</b> <span className="text-dim">({bp.team})</span>: {bp.reason}
                        </li>
                      ))}
                    </ul>
                    <div className="text-gold mt8" style={{ fontSize: '11.5px' }}>
                      * Hệ thống sẽ tự động khóa các cầu thủ này trong danh sách điểm danh ở Bước 3.
                    </div>
                  </div>
                );
              })()}

              <div className="grid-auto mb16">
                <div className="form-group">
                  <label className="form-label">Thời gian thi đấu:</label>
                  <input
                    type="datetime-local"
                    className="input-dark"
                    value={matchDate}
                    onChange={(e) => setMatchDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Trọng tài chính điều khiển:</label>
                  <input
                    type="text"
                    className="input-dark"
                    placeholder="Tên trọng tài..."
                    value={refereeName}
                    onChange={(e) => setRefereeName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Thư ký ghi biên bản:</label>
                  <input
                    type="text"
                    className="input-dark"
                    placeholder="Tên thư ký..."
                    value={secretaryName}
                    onChange={(e) => setSecretaryName(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-between">
                <button type="button" className="btn ghost" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} /> Quay lại
                </button>
                <button type="button" className="btn green" onClick={handleConfirmMatchInfo}>
                  Tiếp tục: Điểm Danh Cầu Thủ <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* BƯỚC 3: ĐIỂM DANH CẦU THỦ RA SÂN & THÊM NHANH NẾU THIẾU */}
          {/* ======================================================== */}
          {step === 3 && selectedMatch && (
            <div className="card animate-fade-in">
              <div className="card-header">
                <div className="card-title">
                  <CheckSquare size={18} className="text-accent" />
                  <span>Bước 3: Kiểm Tra Treo Giò & Điểm Danh (Tùy Chọn)</span>
                </div>
                <span className="badge badge-ghost">Bước 3 / 5</span>
              </div>

              <p className="text-dim mb16">Điểm danh không bắt buộc và không có số lượng tối thiểu. Bạn có thể bắt đầu trận ngay; cầu thủ bị treo giò vẫn được cảnh báo và khóa chọn.</p>
              <div className="grid-2 mb24">
                {/* Team A Lineup */}
                <div className="card" style={{ background: 'var(--bg-secondary)', padding: '16px' }}>
                  <div className="flex-between mb12">
                    <h4 style={{ color: 'var(--accent-green)', fontSize: '15px' }}>
                      {selectedMatch.home}
                    </h4>
                    <span className="badge badge-ghost">
                      {lineupA.filter((p) => p.played).length} Ra sân
                    </span>
                  </div>

                  <div className="table-container mb12" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    <table className="dpl-table">
                      <thead>
                        <tr>
                          <th style={{ width: '45px', textAlign: 'center' }}>Ra Sân</th>
                          <th style={{ width: '45px' }}>Số</th>
                          <th>Họ và Tên</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineupA.length === 0 ? (
                          <tr><td colSpan="3" className="text-center text-dim">Đội chưa có danh sách cầu thủ</td></tr>
                        ) : (
                          lineupA.map((p, i) => {
                            const pKey = `${selectedMatch.home}@@${p.num} - ${p.name}`;
                            const ban = suspensions[`${p.team}@@${p.id}`] || suspensions[pKey];
                            const isBanned = !!ban && ban.remainingMatches !== 0;

                            return (
                              <tr key={i} style={{ opacity: isBanned ? 0.45 : 1 }}>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={p.played && !isBanned}
                                    disabled={isBanned}
                                    onChange={() => togglePlayerAttendance('A', i)}
                                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-green)', cursor: isBanned ? 'not-allowed' : 'pointer' }}
                                  />
                                </td>
                                <td style={{ fontWeight: 'bold', color: 'var(--accent-green)' }}>
                                  #{p.num}
                                </td>
                                <td>
                                  <div>
                                    <span style={{ fontWeight: '600' }}>{p.name}</span>
                                    {p.shirtName && <span className="text-dim" style={{ fontSize: '11px', marginLeft: '6px' }}>({p.shirtName})</span>}
                                  </div>
                                  {isBanned && (
                                    <span className="badge tiny" style={{ background: 'rgba(239,68,68,0.2)', color: 'var(--accent-red)', marginTop: '2px' }}>
                                      🚫 BỊ TREO GIÒ
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Inline Quick Add Player for Team A */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-subtle)' }}>
                    <div className="text-dim mb6" style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <UserPlus size={12} className="text-accent" /> Thêm nhanh cầu thủ vào đội {selectedMatch.home}:
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="number"
                        placeholder="Số"
                        className="input-dark"
                        style={{ width: '55px', padding: '4px 6px', fontSize: '12px' }}
                        value={quickAddA.num}
                        onChange={(e) => setQuickAddA({ ...quickAddA, num: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Họ tên cầu thủ..."
                        className="input-dark"
                        style={{ flex: 1, padding: '4px 8px', fontSize: '12px' }}
                        value={quickAddA.name}
                        onChange={(e) => setQuickAddA({ ...quickAddA, name: e.target.value })}
                      />
                      <button
                        type="button"
                        className="btn green tiny"
                        onClick={() => handleQuickAddPlayer('A')}
                      >
                        + Thêm
                      </button>
                    </div>
                  </div>
                </div>

                {/* Team B Lineup */}
                <div className="card" style={{ background: 'var(--bg-secondary)', padding: '16px' }}>
                  <div className="flex-between mb12">
                    <h4 style={{ color: 'var(--accent-green)', fontSize: '15px' }}>
                      {selectedMatch.away}
                    </h4>
                    <span className="badge badge-ghost">
                      {lineupB.filter((p) => p.played).length} Ra sân
                    </span>
                  </div>

                  <div className="table-container mb12" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    <table className="dpl-table">
                      <thead>
                        <tr>
                          <th style={{ width: '45px', textAlign: 'center' }}>Ra Sân</th>
                          <th style={{ width: '45px' }}>Số</th>
                          <th>Họ và Tên</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineupB.length === 0 ? (
                          <tr><td colSpan="3" className="text-center text-dim">Đội chưa có danh sách cầu thủ</td></tr>
                        ) : (
                          lineupB.map((p, i) => {
                            const pKey = `${selectedMatch.away}@@${p.num} - ${p.name}`;
                            const ban = suspensions[`${p.team}@@${p.id}`] || suspensions[pKey];
                            const isBanned = !!ban && ban.remainingMatches !== 0;

                            return (
                              <tr key={i} style={{ opacity: isBanned ? 0.45 : 1 }}>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={p.played && !isBanned}
                                    disabled={isBanned}
                                    onChange={() => togglePlayerAttendance('B', i)}
                                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-green)', cursor: isBanned ? 'not-allowed' : 'pointer' }}
                                  />
                                </td>
                                <td style={{ fontWeight: 'bold', color: 'var(--accent-green)' }}>
                                  #{p.num}
                                </td>
                                <td>
                                  <div>
                                    <span style={{ fontWeight: '600' }}>{p.name}</span>
                                    {p.shirtName && <span className="text-dim" style={{ fontSize: '11px', marginLeft: '6px' }}>({p.shirtName})</span>}
                                  </div>
                                  {isBanned && (
                                    <span className="badge tiny" style={{ background: 'rgba(239,68,68,0.2)', color: 'var(--accent-red)', marginTop: '2px' }}>
                                      🚫 BỊ TREO GIÒ
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Inline Quick Add Player for Team B */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-subtle)' }}>
                    <div className="text-dim mb6" style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <UserPlus size={12} className="text-accent" /> Thêm nhanh cầu thủ vào đội {selectedMatch.away}:
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="number"
                        placeholder="Số"
                        className="input-dark"
                        style={{ width: '55px', padding: '4px 6px', fontSize: '12px' }}
                        value={quickAddB.num}
                        onChange={(e) => setQuickAddB({ ...quickAddB, num: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Họ tên cầu thủ..."
                        className="input-dark"
                        style={{ flex: 1, padding: '4px 8px', fontSize: '12px' }}
                        value={quickAddB.name}
                        onChange={(e) => setQuickAddB({ ...quickAddB, name: e.target.value })}
                      />
                      <button
                        type="button"
                        className="btn green tiny"
                        onClick={() => handleQuickAddPlayer('B')}
                      >
                        + Thêm
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-between">
                <button type="button" className="btn ghost" onClick={() => setStep(2)}>
                  <ArrowLeft size={16} /> Quay lại Bước 2
                </button>
                <button type="button" className="btn green" onClick={handleStartMatch}>
                  <Play size={16} /> BẮT ĐẦU TRẬN ĐẤU (BẬT ĐỒNG HỒ REALTIME)
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* BƯỚC 4: GHI NHẬN SỰ KIỆN & ĐỒNG HỒ REALTIME (0ms DELAY) */}
          {/* ======================================================== */}
          {step === 4 && selectedMatch && (
            <div className="card animate-fade-in">
              <div className="card-header">
                <div className="card-title">
                  <Play size={18} className="text-red" />
                  <span>Bước 4: Ghi Nhận Sự Kiện Trực Tiếp (Realtime Live)</span>
                </div>
                <div className="live-tag">
                  <span className="live-dot pulse"></span> LIVE ({matchPeriod >= 3 ? `Hiệp phụ ${matchPeriod-2}` : matchPeriod === 1 ? 'Hiệp 1' : matchPeriod === 2 ? 'Hiệp 2' : 'Nghỉ Giữa Trận'})
                </div>
              </div>

              {/* REALTIME MATCH CLOCK & CONTROLS */}
              <div className="card mb16" style={{ background: 'linear-gradient(135deg, #0D1624 0%, #152234 100%)', border: '1px solid rgba(0, 255, 135, 0.4)', padding: '16px 20px' }}>
                <div className="flex-between" style={{ flexWrap: 'wrap', gap: '16px' }}>
                  {/* Clock Display */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0, 255, 135, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={24} className="text-accent" />
                    </div>
                    <div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                        Đồng hồ bấm giờ {matchPeriod >= 3 ? `Hiệp phụ ${matchPeriod-2}` : matchPeriod === 1 ? 'Hiệp 1' : matchPeriod === 2 ? 'Hiệp 2' : 'Nghỉ giữa hiệp'} (Thời lượng: {halfDuration}'/hiệp)
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                        <span style={{ fontSize: '32px', fontFamily: 'var(--font-display)', fontWeight: '900', color: 'var(--accent-green)', letterSpacing: '0.05em' }}>
                          {formatSecondsToMMSS(timerSeconds)}
                        </span>
                        <span className="badge badge-accent-glow" style={{ fontSize: '13px', fontWeight: 'bold' }}>
                          Phút {currentMatchTimeInfo.displayMinute}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timer Action Buttons */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className={`btn small ${isTimerRunning ? 'warning' : 'green'}`}
                      onClick={handleToggleTimer}
                    >
                      {isTimerRunning ? <><Pause size={14} /> Tạm Dừng</> : <><Play size={14} /> Tiếp Tục</>}
                    </button>

                    {matchPeriod === 1 && (
                      <button
                        type="button"
                        className="btn ghost small"
                        style={{ borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)' }}
                        onClick={handleEndFirstHalf}
                      >
                        <Coffee size={14} /> Hết Hiệp 1 ➔ Nghỉ Giữa Trận
                      </button>
                    )}

                    {matchPeriod === 0 && (
                      <button
                        type="button"
                        className="btn green small"
                        onClick={handleStartSecondHalf}
                      >
                        <Play size={14} /> ▶️ Bắt Đầu Hiệp 2
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn ghost tiny"
                      onClick={handleResetTimer}
                      title="Chỉnh lại phút thủ công"
                    >
                      <RotateCcw size={12} /> Chỉnh Phút
                    </button>
                  </div>
                </div>
              </div>

              {/* Tỉ số hiện tại (Nhảy số ngay lập tức 0ms) */}
              <div className="match-banner mb16">
                <div className="scoreboard-container">
                  <div className="team-side home">
                    <div className="team-name">{selectedMatch.home}</div>
                  </div>
                  <div className="score-center">
                    <div className="score-number-box">
                      <span className="score-num">{selectedMatch.scoreA ?? 0}</span>
                      <span className="score-divider">:</span>
                      <span className="score-num">{selectedMatch.scoreB ?? 0}</span>
                    </div>
                  </div>
                  <div className="team-side away">
                    <div className="team-name">{selectedMatch.away}</div>
                  </div>
                </div>

                {selectedMatch.group === 'Vòng Knock-out' && selectedMatch.scoreA === selectedMatch.scoreB && <ShootoutPanel match={{ ...selectedMatch, lineupA, lineupB }} players={allPlayers} suspensions={suspensions} rounds={tourConfig.shootoutRounds || 5} extraTimeMinutes={Number(tourConfig.extraTimeMinutes || 0)} onChange={async kicks => {
    try {
 await update(ref(db, `matches/${selectedMatch.id}`), { shootout: kicks }); setSelectedMatch(prev => ({ ...prev, shootout: kicks }));
    } catch (error) { toast.error(error.message || "Không lưu được dữ liệu."); throw error; }
}}/>}
              </div>

              {/* Form Thêm Sự Kiện (Tự Động Điền Phút Đồng Hồ) */}
              <div className="card mb16" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-card)' }}>
                <div className="flex-between mb12">
                  <h4 style={{ color: 'var(--accent-green)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} /> Ghi Thêm Sự Kiện Mới (Bàn Thắng / Thẻ Phạt)
                  </h4>
                  <span className="badge badge-accent-glow" style={{ fontSize: '11px' }}>
                    Tự động ghi phút: <b>{currentMatchTimeInfo.displayMinute}</b>
                  </span>
                </div>

                <div className="grid-auto mb12">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Loại sự kiện:</label>
                    <select
                      className="select-dark"
                      value={eventType}
                      onChange={(e) => {
                        setEventType(e.target.value);
                        setEvDetail(e.target.value === 'goal' ? 'normal' : 'Vàng');
                      }}
                    >
                      <option value="goal">⚽ Bàn Thắng</option>
                      <option value="card">🟨 / 🟥 Thẻ Phạt</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Chi tiết hình thức:</label>
                    {eventType === 'goal' ? (
                      <select
                        className="select-dark"
                        value={evDetail}
                        onChange={(e) => setEvDetail(e.target.value)}
                      >
                        <option value="normal">Bàn thắng thường</option>
                        <option value="own">Phản lưới nhà (OG)</option>
                        <option value="pen">Phạt đền (Penalty trong trận)</option>
                      </select>
                    ) : (
                      <select
                        className="select-dark"
                        value={evDetail}
                        onChange={(e) => setEvDetail(e.target.value)}
                      >
                        <option value="Vàng">Thẻ Vàng 🟨</option>
                        <option value="second_yellow_red">Vàng thứ hai / Truất quyền thi đấu</option><option value="Đỏ">Thẻ Đỏ 🟥</option>
                      </select>
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Chọn Đội:</label>
                    <select
                      className="select-dark"
                      value={evTeam}
                      onChange={(e) => {
                        setEvTeam(e.target.value);
                        setEvPlayer('');
                      }}
                    >
                      <option value="">-- Chọn Đội --</option>
                      <option value={selectedMatch.home}>{selectedMatch.home}</option>
                      <option value={selectedMatch.away}>{selectedMatch.away}</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Chọn Cầu thủ:</label>
                    <select
                      className="select-dark"
                      value={evPlayer}
                      onChange={(e) => setEvPlayer(e.target.value)}
                      disabled={!evTeam}
                    >
                      <option value="">-- Chọn Cầu thủ --</option>
                      {evTeam === selectedMatch.home &&
                        lineupA.map((p) => (
                          <option key={p.num} disabled={eventType!=='card' && (suspensions[`${evTeam}@@${p.id}`]?.remainingMatches>0)} value={`${p.num} - ${p.name}`}>
                            #{p.num} - {p.name} {p.shirtName ? `(${p.shirtName})` : ''} {suspensions[`${evTeam}@@${p.id}`]?.remainingMatches>0?'· Treo giò':''}
                          </option>
                        ))}
                      {evTeam === selectedMatch.away &&
                        lineupB.map((p) => (
                          <option key={p.num} disabled={eventType!=='card' && (suspensions[`${evTeam}@@${p.id}`]?.remainingMatches>0)} value={`${p.num} - ${p.name}`}>
                            #{p.num} - {p.name} {p.shirtName ? `(${p.shirtName})` : ''} {suspensions[`${evTeam}@@${p.id}`]?.remainingMatches>0?'· Treo giò':''}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Phút thi đấu (để trống để lấy tự động):</label>
                    <input
                      type="text"
                      className="input-dark"
                      placeholder={`Mặc định: ${currentMatchTimeInfo.displayMinute}`}
                      value={customMin}
                      onChange={(e) => setCustomMin(e.target.value)}
                    />
                  </div>
                </div>

                <div className="text-right">
                  {selectedMatch.group==='Vòng Knock-out'&&selectedMatch.scoreA===selectedMatch.scoreB&&Number(tourConfig.extraTimeMinutes)>0&&[2,3].includes(matchPeriod)&&<button className="btn warning" onClick={()=>startExtraPeriod(matchPeriod+1)}>Bắt đầu hiệp phụ {matchPeriod===2?1:2} · {tourConfig.extraTimeMinutes} phút</button>}
                  {eventType==='card'&&selectedMatch.group==='Vòng Knock-out'&&selectedMatch.scoreA===selectedMatch.scoreB&&<label className="form-label">Giai đoạn thẻ<select className="select-dark" value={evPhase} onChange={e=>setEvPhase(e.target.value)}><option value="play">Trong trận</option><option value="shootout">Trong loạt luân lưu (vàng tách riêng)</option></select></label>}
                  <button type="button" className="btn green" onClick={handleAddEvent} disabled={savingEvent}>
                    <Plus size={16} /> Lưu sự kiện & đồng bộ
                  </button>
                </div>
              </div>

              {/* Danh sách sự kiện */}
              <div className="mb24">
                <h4 className="mb8" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  📋 Danh sách các sự kiện đã ghi nhận ({events.length})
                </h4>

                <div className="table-container">
                  <table className="dpl-table">
                    <thead>
                      <tr>
                        <th style={{ width: '70px' }}>Phút</th>
                        <th>Loại Sự Kiện</th>
                        <th>Chi Tiết</th>
                        <th>Cầu Thủ</th>
                        <th>Đội Bóng</th>
                        <th style={{ width: '60px', textAlign: 'center' }}>Xóa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center text-dim" style={{ padding: '20px' }}>
                            Chưa có sự kiện nào trong biên bản.
                          </td>
                        </tr>
                      ) : (
                        events.map((e) => (
                          <tr key={e.id}>
                            <td style={{ fontWeight: '800', color: 'var(--accent-green)' }}>
                              {e.displayMinute || `${e.minute}'`}
                            </td>
                            <td>{e.type === 'goal' ? '⚽ Bàn thắng' : 'Thẻ phạt'}</td>
                            <td>
                              {e.detail === 'own' ? (
                                <span className="badge" style={{ background: '#78350F', color: '#FEF3C7' }}>Phản lưới nhà (OG)</span>
                              ) : e.detail === 'pen' ? (
                                <span className="badge badge-ghost">Penalty</span>
                              ) : e.detail === 'Vàng' || e.detail === 'yellow' ? (
                                <span className="badge" style={{ background: 'var(--accent-gold)', color: '#000' }}>Thẻ Vàng 🟨</span>
                              ) : e.detail === 'Đỏ' || e.detail === 'red' || e.detail === 'direct_red' || e.detail === 'second_yellow_red' ? (
                                <span className="badge" style={{ background: 'var(--accent-red)', color: '#fff' }}>Thẻ Đỏ 🟥</span>
                              ) : (
                                'Bàn thắng thường'
                              )}
                            </td>
                            <td style={{ fontWeight: '600' }}>{cleanPlayerName(e.player)}</td>
                            <td>{e.team}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn danger tiny"
                                onClick={() => handleRemoveEvent(e.id)}
                                title="Xóa sự kiện"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* End Match Button */}
              <div className="text-center">
                <button
                  type="button"
                  className="btn danger"
                  style={{ padding: '12px 28px', fontSize: '15px' }}
                  onClick={handleEndMatch}
                >
                  🛑 KẾT THÚC TRẬN ĐẤU ➔ Kiểm Tra Biên Bản & Ký Tên
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* BƯỚC 5: XEM LẠI BIÊN BẢN, GHI CHÚ BTC & KÝ XÁC NHẬN */}
          {/* ======================================================== */}
          {step === 5 && selectedMatch && (
            <div className="card animate-fade-in">
              <div className="card-header">
                <div className="card-title">
                  <CheckCircle2 size={18} className="text-accent" />
                  <span>Bước 5: Kiểm Tra Lại Biên Bản & Ký Xác Nhận</span>
                </div>
                <span className="badge badge-accent-glow">Bước 5 / 5</span>
              </div>

              {/* Tóm tắt biên bản trận đấu */}
              <div className="card mb20" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-card)' }}>
                <h4 className="mb12" style={{ color: 'var(--accent-green)', fontSize: '14px' }}>
                  📊 TỔNG KẾT BIÊN BẢN TRẬN ĐẤU:
                </h4>

                <div className="flex-between mb16" style={{ background: '#070C12', padding: '14px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: '800', fontSize: '16px' }}>{selectedMatch.home}</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--accent-green)' }}>
                      {selectedMatch.scoreA ?? 0} - {selectedMatch.scoreB ?? 0}
                    </div>
                    {penA !== '' && penB !== '' && (
                      <div className="text-gold" style={{ fontSize: '12px', fontWeight: 'bold' }}>
                        Pen: {penA} - {penB}
                      </div>
                    )}
                  </div>
                  <div style={{ fontWeight: '800', fontSize: '16px' }}>{selectedMatch.away}</div>
                </div>

                {/* Danh sách sự kiện tóm tắt */}
                <div className="table-container mb16">
                  <table className="dpl-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>Phút</th>
                        <th>Loại Sự Kiện</th>
                        <th>Chi Tiết</th>
                        <th>Cầu Thủ</th>
                        <th>Đội Bóng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.length === 0 ? (
                        <tr><td colSpan="5" className="text-center text-dim">Không có bàn thắng hoặc thẻ phạt nào.</td></tr>
                      ) : (
                        events.map((e) => (
                          <tr key={e.id}>
                            <td style={{ fontWeight: 'bold', color: 'var(--accent-green)' }}>
                              {e.displayMinute || `${e.minute}'`}
                            </td>
                            <td>{e.type === 'goal' ? '⚽ Bàn thắng' : 'Thẻ phạt'}</td>
                            <td>{e.detail === 'own' ? 'Phản lưới nhà' : e.detail === 'pen' ? 'Penalty' : e.detail}</td>
                            <td style={{ fontWeight: '600' }}>{cleanPlayerName(e.player)}</td>
                            <td>{e.team}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Ghi chú / Nhắn nhủ gửi Ban Tổ Chức */}
                <div className="form-group mb0">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-gold)' }}>
                    <MessageSquare size={15} /> Ghi chú / Ý kiến của Thư ký gửi Ban Tổ Chức (nếu có):
                  </label>
                  <textarea
                    rows={3}
                    className="input-dark"
                    placeholder="Nhập nhắn nhủ cho BTC (ví dụ: sự cố trận đấu, khiếu nại, đề xuất xem lại thẻ phạt, cầu thủ chấn thương...)..."
                    value={secretaryNote}
                    onChange={(e) => setSecretaryNote(e.target.value)}
                  />
                </div>
              </div>

              <p className="text-dim mb16" style={{ fontSize: '13px' }}>
                Đại diện Đội trưởng 2 đội và Trọng tài chính vui lòng kiểm tra kỹ các sự kiện và ký tên điện tử xác nhận bên dưới:
              </p>

              <div className="grid-3 mb24">
                <SignatureCanvas
                  ref={sigRefA}
                  label={`Đội trưởng ${selectedMatch.home}`}
                  initialDataUrl={selectedMatch.signatures?.home || ''}
                  onChange={value => setSelectedMatch(prev => ({ ...prev, signatures: { ...prev.signatures, home: value } }))}
                  width={280}
                  height={130}
                />

                <SignatureCanvas
                  ref={sigRefB}
                  label={`Đội trưởng ${selectedMatch.away}`}
                  initialDataUrl={selectedMatch.signatures?.away || ''}
                  onChange={value => setSelectedMatch(prev => ({ ...prev, signatures: { ...prev.signatures, away: value } }))}
                  width={280}
                  height={130}
                />

                <SignatureCanvas
                  ref={sigRefReferee}
                  label="Trọng tài chính"
                  initialDataUrl={selectedMatch.signatures?.referee || ''}
                  onChange={value => setSelectedMatch(prev => ({ ...prev, signatures: { ...prev.signatures, referee: value } }))}
                  width={280}
                  height={130}
                />
              </div>

              <div className="flex-between" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setStep(4)}
                  disabled={isSubmitting}
                >
                  <ArrowLeft size={16} /> Quay lại Sửa Sự Kiện
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={isSubmitting}
                    onClick={() => {
                      const { goalsA, goalsB } = calculateEventsGoals(events, selectedMatch.home, selectedMatch.away);
                      setPrintingMatch({
                        ...selectedMatch,
                        date: normalizeKickoff(matchDate),
                        ref: refereeName,
                        sec: secretaryName,
                        lineupA,
                        lineupB,
                        events,
                        scoreA: goalsA,
                        scoreB: goalsB,
                        penA,
                        penB,
                        secretaryNote,
                        signatures: {
                          home: sigRefA.current?.getDataUrl() || selectedMatch.signatures?.home || '',
                          away: sigRefB.current?.getDataUrl() || selectedMatch.signatures?.away || '',
                          referee: sigRefReferee.current?.getDataUrl() || selectedMatch.signatures?.referee || ''
                        }
                      });
                    }}
                  >
                    <Printer size={15} /> In Biên Bản (A4)
                  </button>

                  <button
                    type="button"
                    className="btn green"
                    style={{ padding: '12px 28px', fontSize: '15px' }}
                    onClick={handleSubmitReport}
                    disabled={isSubmitting}
                  >
                    <Send size={16} /> {isSubmitting ? 'Đang nộp biên bản...' : '✅ XÁC NHẬN & NỘP BIÊN BẢN LÊN BTC'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* TAB 2: TRA CỨU CẦU THỦ */}
      {/* ======================================================== */}
      {innerTab === 'thongtin' && (
        <section className="card animate-fade-in">
          <div className="card-header">
            <div className="card-title">
              <Search size={18} className="text-accent" />
              <span>Tra Cứu Hồ Sơ Cầu Thủ</span>
            </div>
            <span className="badge badge-ghost">{filteredPlayers.length} Cầu Thủ</span>
          </div>

          <div className="grid-2 mb16">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tìm kiếm Số áo / Tên thật / Tên in áo:</label>
              <input
                type="text"
                className="input-dark"
                placeholder="Gõ số áo hoặc tên cầu thủ..."
                value={searchPlayerTxt}
                onChange={(e) => setSearchPlayerTxt(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Lọc theo Đội bóng:</label>
              <select
                className="select-dark"
                value={searchTeamFilter}
                onChange={(e) => setSearchTeamFilter(e.target.value)}
              >
                <option value="">-- Tất cả các đội --</option>
                {Object.keys(allPlayers).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-auto">
            {filteredPlayers.length === 0 ? (
              <div className="empty-state-card" style={{ gridColumn: '1 / -1' }}>
                Không tìm thấy cầu thủ nào.
              </div>
            ) : (
              filteredPlayers.map((p, idx) => (
                <div
                  key={`${p.teamName}-${p.num}-${idx}`}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  {p.avatar ? (
                    <img
                      src={p.avatar}
                      alt={p.name}
                      style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-green)' }}
                    />
                  ) : (
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--bg-card-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-card)', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                      #{p.num}
                    </div>
                  )}

                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '11px', color: 'var(--accent-green)', fontWeight: 'bold' }}>
                      #{p.num} • {p.teamName}
                    </div>
                    <div style={{ fontSize: '14.5px', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </div>
                    {p.shirtName && (
                      <div className="text-dim" style={{ fontSize: '11.5px' }}>
                        In áo: <b>{p.shirtName}</b>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
