// src/pages/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { ref, set, update, onValue, remove } from 'firebase/database';
import { db } from '../services/firebase';
import {
  Trophy,
  Users,
  Settings,
  Plus,
  Trash2,
  Upload,
  Edit,
  Check,
  X,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Sparkles,
  Zap,
  Copy,
  Download,
  FileCode,
  Bot,
  MessageSquare,
  Shield,
  FileText,
  RotateCcw,
  Printer
} from 'lucide-react';
import { useToast } from '../components/ToastContext';
import {
  calculateGroupStandings,
  detectViolations,
  generateRoundRobinMatches,
  formatDateTime,
  cleanPlayerName,
  isGroupStageFinished,
  getQualifyingCount,
  calculateEventsGoals,
  generateKnockoutPairs
} from '../services/tournamentService';
import KnockoutBracket from '../components/KnockoutBracket';
import MatchPrintReport from '../components/MatchPrintReport';

// Prompt AI chuẩn để chuyển đổi danh sách
const AI_PROMPT_TEMPLATE = `Tôi có danh sách cầu thủ bóng đá thô dưới đây. Hãy chuyển đổi toàn bộ thành định dạng JSON chuẩn cho hệ thống Dược Premier League theo đúng cấu trúc sau:

[
  {
    "soAo": 10,
    "ten": "Họ và tên đầy đủ",
    "tenAo": "Tên in trên lưng áo",
    "avatar": "Link ảnh đại diện (nếu có, không có thì để trống \\"\\")"
  }
]

Yêu cầu:
1. Chỉ trả về mã JSON hợp lệ dạng Array, không giải thích gì thêm.
2. Số áo là số nguyên (1 - 99), không trùng nhau trong cùng 1 đội.
3. Tên in áo ngắn gọn (1-2 từ).

Danh sách cầu thủ:
[Dán danh sách cầu thủ của bạn tại đây]`;

const SAMPLE_JSON_SNIPPET = `[
  {
    "soAo": 1,
    "ten": "Trần Văn Hùng",
    "tenAo": "V.HÙNG",
    "avatar": ""
  },
  {
    "soAo": 10,
    "ten": "Đặng Tuấn Anh",
    "tenAo": "T.ANH",
    "avatar": ""
  }
]`;

export default function AdminDashboard() {
  const toast = useToast();
  const [adminTab, setAdminTab] = useState('dieuhanh'); // 'dieuhanh', 'cauthu', 'xembxh'

  // ==========================================
  // 1. STATE ĐỒNG BỘ TỪ FIREBASE
  // ==========================================
  const [tourStatus, setTourStatus] = useState('none');
  const [tourConfig, setTourConfig] = useState({
    name: 'Dược Premier League 2026',
    format: 'group',
    numGroups: 2,
    knockoutFormat: 'quarter', // 'quarter' (Tứ kết) hoặc 'semi' (Bán kết)
    halfDuration: 20 // Số phút 1 hiệp (mặc định 20 phút cho bóng đá sân 7)
  });
  const [groupsData, setGroupsData] = useState([]);
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState({});
  const [suspensions, setSuspensions] = useState({});
  const [handledViolations, setHandledViolations] = useState({});

  // Local state for editing players
  const [editTeam, setEditTeam] = useState('');
  const [editingPlayers, setEditingPlayers] = useState([]);
  const [printingMatch, setPrintingMatch] = useState(null);

  // Subscribe to Firebase on mount
  useEffect(() => {
    onValue(ref(db, 'tourStatus'), (snap) => setTourStatus(snap.val() || 'none'));
    onValue(ref(db, 'tourConfig'), (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setTourConfig({
          name: val.name || 'Dược Premier League 2026',
          format: val.format || 'group',
          numGroups: val.numGroups || 2,
          knockoutFormat: val.knockoutFormat || 'quarter',
          halfDuration: val.halfDuration || 20
        });
      }
    });
    onValue(ref(db, 'groupsData'), (snap) => setGroupsData(snap.val() || []));
    onValue(ref(db, 'matches'), (snap) => {
      const data = snap.val();
      setMatches(data ? Object.keys(data).map((k) => ({ id: k, ...data[k] })) : []);
    });
    onValue(ref(db, 'players'), (snap) => {
      const pData = snap.val() || {};
      setPlayers(pData);
      if (editTeam) {
        setEditingPlayers(pData[editTeam] || []);
      }
    });
    onValue(ref(db, 'suspensions'), (snap) => setSuspensions(snap.val() || {}));
    onValue(ref(db, 'handledViolations'), (snap) => setHandledViolations(snap.val() || {}));
  }, [editTeam]);

  // ==========================================
  // 2. STATE CỤC BỘ (FORMS)
  // ==========================================
  const [teamInputs, setTeamInputs] = useState({});

  // Knock-out generator wizard
  const [koStep, setKoStep] = useState(1);
  const [koFormatSelection, setKoFormatSelection] = useState('quarter');
  const [koRoundName, setKoRoundName] = useState('Tứ Kết');
  const [koMatchesForm, setKoMatchesForm] = useState([]);

  // Match Review Modal
  const [reviewingMatch, setReviewingMatch] = useState(null);
  const [revEvType, setRevEvType] = useState('goal');
  const [revEvDetail, setRevEvDetail] = useState('normal');
  const [revEvTeam, setRevEvTeam] = useState('');
  const [revEvPlayer, setRevEvPlayer] = useState('');
  const [revEvMin, setRevEvMin] = useState('');

  // Player Management Tab State
  const [playerTab, setPlayerTab] = useState('upload'); // 'upload' | 'edit'
  const [newPlayer, setNewPlayer] = useState({ team: '', num: '', name: '', shirtName: '' });

  const handleSelectEditTeam = (tName) => {
    setEditTeam(tName);
    setEditingPlayers(players[tName] || []);
  };

  // ==========================================
  // 3. THUẬT TOÁN KỶ LUẬT
  // ==========================================
  const violations = detectViolations(matches, handledViolations);

  const handleBanPlayer = (v) => {
    if (window.confirm(`Xác nhận TREO GIÒ cầu thủ ${v.player} (${v.team})? Cầu thủ này sẽ bị khóa ở trận tiếp theo.`)) {
      const updates = {};
      updates[`handledViolations/${v.key}`] = true;
      updates[`suspensions/${v.pKey}`] = { reason: v.reason, matchId: v.key, createdAt: new Date().toISOString() };
      update(ref(db, '/'), updates);
      toast.success(`Đã áp dụng án phạt treo giò với ${v.player}`);
    }
  };

  const handlePardonWarning = (v) => {
    if (window.confirm(`Ân xá (Bỏ qua cảnh báo lỗi này) cho ${v.player}? Hệ thống sẽ không nhắc lại.`)) {
      update(ref(db, `handledViolations/${v.key}`), true);
      toast.info(`Đã ân xá cảnh báo của ${v.player}`);
    }
  };

  const handleRemoveActiveBan = (pKey, playerName) => {
    if (window.confirm(`Xác nhận GỠ ÁN PHẠT TREO GIÒ cho ${playerName}? Cầu thủ sẽ được phép ra sân trở lại.`)) {
      remove(ref(db, `suspensions/${pKey}`));
      toast.success(`Đã gỡ án phạt treo giò cho ${playerName}`);
    }
  };

  // ==========================================
  // 4. QUẢN LÝ VÒNG ĐỜI GIẢI ĐẤU
  // ==========================================
  const handleGoToSetupTeams = () => {
    if (!tourConfig.name?.trim()) {
      toast.warning('Vui lòng nhập Tên Giải Đấu!');
      return;
    }

    let initialGroups = [];
    if (tourConfig.format === 'league') {
      initialGroups.push({ groupName: 'Bảng Tổng (League)', teams: [] });
    } else {
      if (tourConfig.numGroups < 2) {
        toast.warning('Thể thức chia bảng phải có ít nhất 2 bảng!');
        return;
      }
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let i = 0; i < tourConfig.numGroups; i++) {
        initialGroups.push({ groupName: `Bảng ${alphabet[i]}`, teams: [] });
      }
    }

    set(ref(db, 'tourConfig'), tourConfig);
    set(ref(db, 'groupsData'), initialGroups);
    set(ref(db, 'tourStatus'), 'setup_teams');
    toast.success('Đã khởi tạo cấu hình giải đấu!');
  };

  const handleAddTeamToGroup = (gIndex) => {
    const tName = teamInputs[gIndex]?.trim();
    if (!tName) return;

    const newGroups = [...groupsData];
    if (!newGroups[gIndex].teams) newGroups[gIndex].teams = [];

    // Kiểm tra trùng tên
    if (groupsData.some((g) => (g.teams || []).includes(tName))) {
      toast.warning(`Tên đội "${tName}" đã tồn tại trong giải đấu!`);
      return;
    }

    newGroups[gIndex].teams.push(tName);
    set(ref(db, 'groupsData'), newGroups);
    setTeamInputs({ ...teamInputs, [gIndex]: '' });
    toast.success(`Đã thêm đội ${tName}`);
  };

  const handleRemoveTeam = (gIndex, tName) => {
    const newGroups = [...groupsData];
    newGroups[gIndex].teams = (newGroups[gIndex].teams || []).filter((t) => t !== tName);
    set(ref(db, 'groupsData'), newGroups);
    toast.info(`Đã xóa đội ${tName}`);
  };

  const generateSchedule = () => {
    const isValid = groupsData.every((g) => (g.teams || []).length >= 2);
    if (!isValid) {
      toast.warning('Mỗi bảng đấu phải có ít nhất 2 đội để sinh lịch!');
      return;
    }

    const matchesObj = generateRoundRobinMatches(groupsData);
    set(ref(db, 'matches'), matchesObj);
    set(ref(db, 'tourStatus'), 'draft');
    toast.success('🎉 Đã tự động sinh lịch thi đấu Vòng Bảng!');
  };

  const handlePublishTournament = () => {
    set(ref(db, 'tourStatus'), 'active');
    toast.success('🎉 GIẢI ĐẤU ĐÃ CHÍNH THỨC KHỞI TRANH!');
  };

  const handleCompleteTour = () => {
    if (window.confirm('Xác nhận KHÉP LẠI giải đấu? Khán giả vẫn xem được BXH nhưng Thư ký sẽ không thể sửa đổi nữa.')) {
      set(ref(db, 'tourStatus'), 'completed');
      toast.success('Giải đấu đã chuyển sang trạng thái Hoàn Thành!');
    }
  };

  const handleDeleteTour = () => {
    if (window.confirm('⚠️ CẢNH BÁO ĐỎ: Hành động này sẽ XÓA SẠCH toàn bộ dữ liệu giải đấu (Lịch, BXH, Trận đấu). Các tài khoản đăng nhập vẫn được giữ an toàn. Bạn có chắc chắn?')) {
      const resetData = {
        tourStatus: null,
        tourConfig: null,
        groupsData: null,
        matches: null,
        players: null,
        suspensions: null,
        handledViolations: null
      };
      update(ref(db, '/'), resetData);
      toast.info('Đã reset toàn bộ giải đấu về mặc định');
    }
  };

  // ==========================================
  // 5. QUẢN LÝ TIẾN TRÌNH VÒNG KNOCK-OUT
  // ==========================================
  const koMatches = matches.filter((m) => m.group === 'Vòng Knock-out');
  const qfMatches = koMatches.filter((m) => m.round?.includes('Tứ Kết'));
  const sfMatches = koMatches.filter((m) => m.round?.includes('Bán Kết'));
  const finalMatches = koMatches.filter((m) => m.round?.includes('Chung Kết'));
  const thirdMatches = koMatches.filter((m) => m.round?.includes('Tranh Hạng 3'));

  const qfDoneCount = qfMatches.filter((m) => m.status === 'Đã xong' && m.advancingTeam).length;
  const sfDoneCount = sfMatches.filter((m) => m.status === 'Đã xong' && m.advancingTeam).length;
  const finalDone = finalMatches.length > 0 && finalMatches.every((m) => m.status === 'Đã xong' && m.advancingTeam);
  const thirdDone = thirdMatches.length > 0 && thirdMatches.every((m) => m.status === 'Đã xong' && m.advancingTeam);

  // Khởi tạo vòng Knock-out đầu tiên (Chỉ tạo 1 lần duy nhất)
  const handleStartKoWizard = (format) => {
    setKoFormatSelection(format);
    const roundTitle = format === 'quarter' ? 'Tứ Kết' : 'Bán Kết';
    setKoRoundName(roundTitle);

    update(ref(db, 'tourConfig'), { knockoutFormat: format });

    const suggestedPairs = generateKnockoutPairs(groupsData, matches, format);
    const initialMatches = suggestedPairs.map((p) => ({
      home: p.home.startsWith('Nhất') || p.home.startsWith('Hạng') ? '' : p.home,
      away: p.away.startsWith('Nhất') || p.away.startsWith('Hạng') ? '' : p.away,
      label: p.label,
      date: ''
    }));

    setKoMatchesForm(initialMatches);
    setKoStep(2);
  };

  const handleAutoFillFromStandings = () => {
    const suggestedPairs = generateKnockoutPairs(groupsData, matches, koFormatSelection);
    const updated = suggestedPairs.map((p, idx) => ({
      ...koMatchesForm[idx],
      home: p.home,
      away: p.away,
      label: p.label
    }));
    setKoMatchesForm(updated);
    toast.success('⚡ Đã tự động điền các cặp đấu từ kết quả Bảng Xếp Hạng!');
  };

  const handleCreateKnockoutMatches = () => {
    let isValid = true;
    let updates = {};

    koMatchesForm.forEach((m, idx) => {
      if (!m.home || !m.away) isValid = false;
      const matchId = `match_ko_${Date.now()}_${idx}`;
      updates[`matches/${matchId}`] = {
        id: matchId,
        group: 'Vòng Knock-out',
        round: `${koRoundName} ${koMatchesForm.length > 1 ? idx + 1 : ''}`.trim(),
        home: m.home,
        away: m.away,
        date: m.date || '',
        ref: '',
        sec: '',
        status: 'Sắp diễn ra',
        scoreA: 0,
        scoreB: 0,
        penA: '',
        penB: '',
        events: [],
        advancingTeam: ''
      };
    });

    if (!isValid) {
      toast.warning('Vui lòng chọn đầy đủ 2 đội cho tất cả các cặp đấu Knock-out!');
      return;
    }

    update(ref(db, '/'), updates);
    toast.success(`🎉 Đã tạo vòng ${koRoundName} thành công!`);
    setKoStep(1);
  };

  // Tạo 2 trận Bán Kết sau khi xong 4 trận Tứ Kết
  const handleCreateSemiFinals = () => {
    if (qfDoneCount < 4) {
      toast.warning('Cần hoàn thành và duyệt đủ 4 trận Tứ Kết trước khi tạo Bán Kết!');
      return;
    }

    const w1 = qfMatches[0]?.advancingTeam;
    const w2 = qfMatches[1]?.advancingTeam;
    const w3 = qfMatches[2]?.advancingTeam;
    const w4 = qfMatches[3]?.advancingTeam;

    if (!w1 || !w2 || !w3 || !w4) {
      toast.warning('Chưa xác định đủ 4 đội thắng Tứ Kết!');
      return;
    }

    const updates = {};
    const bk1Id = `match_ko_bk_1_${Date.now()}`;
    const bk2Id = `match_ko_bk_2_${Date.now()}`;

    updates[`matches/${bk1Id}`] = {
      id: bk1Id,
      group: 'Vòng Knock-out',
      round: 'Bán Kết 1',
      home: w1,
      away: w2,
      date: '',
      ref: '',
      sec: '',
      status: 'Sắp diễn ra',
      scoreA: 0,
      scoreB: 0,
      penA: '',
      penB: '',
      events: [],
      advancingTeam: ''
    };

    updates[`matches/${bk2Id}`] = {
      id: bk2Id,
      group: 'Vòng Knock-out',
      round: 'Bán Kết 2',
      home: w3,
      away: w4,
      date: '',
      ref: '',
      sec: '',
      status: 'Sắp diễn ra',
      scoreA: 0,
      scoreB: 0,
      penA: '',
      penB: '',
      events: [],
      advancingTeam: ''
    };

    update(ref(db, '/'), updates);
    toast.success('🎉 ĐÃ TẠO 2 TRẬN BÁN KẾT THÀNH CÔNG!');
  };

  // Tạo 2 trận Chung Kết & Tranh Hạng 3 sau khi xong 2 trận Bán Kết
  const handleCreateFinalsAndThirdPlace = () => {
    if (sfDoneCount < 2) {
      toast.warning('Cần hoàn thành và duyệt đủ 2 trận Bán Kết trước khi tạo Chung Kết!');
      return;
    }

    const bk1 = sfMatches[0];
    const bk2 = sfMatches[1];

    const w1 = bk1.advancingTeam;
    const w2 = bk2.advancingTeam;
    const l1 = bk1.home === bk1.advancingTeam ? bk1.away : bk1.home;
    const l2 = bk2.home === bk2.advancingTeam ? bk2.away : bk2.home;

    if (!w1 || !w2 || !l1 || !l2) {
      toast.warning('Chưa xác định đủ đội thắng và đội thua Bán Kết!');
      return;
    }

    const updates = {};
    const finalId = `match_ko_final_${Date.now()}`;
    const thirdId = `match_ko_third_${Date.now()}`;

    // Trận Chung Kết (Vô Địch & Á Quân 🥇🥈)
    updates[`matches/${finalId}`] = {
      id: finalId,
      group: 'Vòng Knock-out',
      round: 'Chung Kết',
      home: w1,
      away: w2,
      date: '',
      ref: '',
      sec: '',
      status: 'Sắp diễn ra',
      scoreA: 0,
      scoreB: 0,
      penA: '',
      penB: '',
      events: [],
      advancingTeam: ''
    };

    // Trận Tranh Hạng Ba (Huy Chương Đồng 🥉)
    updates[`matches/${thirdId}`] = {
      id: thirdId,
      group: 'Vòng Knock-out',
      round: 'Tranh Hạng 3',
      home: l1,
      away: l2,
      date: '',
      ref: '',
      sec: '',
      status: 'Sắp diễn ra',
      scoreA: 0,
      scoreB: 0,
      penA: '',
      penB: '',
      events: [],
      advancingTeam: ''
    };

    update(ref(db, '/'), updates);
    toast.success('🏆 ĐÃ TẠO TRẬN CHUNG KẾT VÀ TRANH HẠNG 3 THÀNH CÔNG!');
  };

  // Reset nhánh Knockout nếu muốn thiết lập lại
  const handleResetKnockoutBranch = () => {
    if (window.confirm('⚠️ XÁC NHẬN TẠO LẠI VÒNG KNOCK-OUT TỪ ĐẦU?\nToàn bộ các trận Knock-out (Tứ Kết, Bán Kết, Chung Kết) hiện tại sẽ bị xóa để thiết lập lại.')) {
      const updates = {};
      koMatches.forEach((m) => {
        updates[`matches/${m.id}`] = null;
      });
      update(ref(db, '/'), updates);
      setKoStep(1);
      toast.info('Đã xóa các trận Knock-out để thiết lập lại');
    }
  };

  // ==========================================
  // 6. PHÊ DUYỆT & SỬA BIÊN BẢN (LOGIC CHẶT CHẼ)
  // ==========================================
  const handleOpenReview = (match) => {
    setReviewingMatch(JSON.parse(JSON.stringify(match)));
    setRevEvTeam('');
    setRevEvPlayer('');
    setRevEvMin('');
  };

  const handleScoreChange = (side, rawVal) => {
    const num = Math.max(0, parseInt(rawVal) || 0);
    if (side === 'A') {
      setReviewingMatch({ ...reviewingMatch, scoreA: num });
    } else {
      setReviewingMatch({ ...reviewingMatch, scoreB: num });
    }
  };

  const handleAddReviewEvent = () => {
    if (!revEvTeam || !revEvPlayer || !revEvMin) {
      toast.warning('Vui lòng chọn Đội, Cầu thủ và nhập Số phút!');
      return;
    }

    const minNum = Math.max(1, parseInt(revEvMin) || 1);
    const newEv = {
      id: Date.now(),
      type: revEvType,
      detail: revEvDetail,
      team: revEvTeam,
      player: revEvPlayer,
      minute: minNum,
      displayMinute: revEvMin.includes('+') || revEvMin.includes("'") ? revEvMin : `${minNum}'`
    };

    const updatedEvents = [...(reviewingMatch.events || []), newEv].sort((a, b) => a.minute - b.minute);
    const { goalsA, goalsB } = calculateEventsGoals(updatedEvents, reviewingMatch.home, reviewingMatch.away);

    setReviewingMatch({
      ...reviewingMatch,
      events: updatedEvents,
      scoreA: goalsA,
      scoreB: goalsB
    });

    setRevEvMin('');
    toast.success(`Đã thêm sự kiện phút ${newEv.displayMinute} và cập nhật tỉ số (${goalsA} - ${goalsB})`);
  };

  const handleRemoveReviewEvent = (evId) => {
    const updatedEvents = (reviewingMatch.events || []).filter((e) => e.id !== evId);
    const { goalsA, goalsB } = calculateEventsGoals(updatedEvents, reviewingMatch.home, reviewingMatch.away);

    setReviewingMatch({
      ...reviewingMatch,
      events: updatedEvents,
      scoreA: goalsA,
      scoreB: goalsB
    });

    toast.info(`Đã xóa sự kiện. Tỉ số được cập nhật lại: ${goalsA} - ${goalsB}`);
  };

  const handleSyncScoreFromEvents = () => {
    const { goalsA, goalsB } = calculateEventsGoals(reviewingMatch.events || [], reviewingMatch.home, reviewingMatch.away);
    setReviewingMatch({
      ...reviewingMatch,
      scoreA: goalsA,
      scoreB: goalsB
    });
    toast.success(`Đã đồng bộ tỉ số về: ${goalsA} - ${goalsB}`);
  };

  const handleSaveAndApprove = () => {
    const finalScoreA = Math.max(0, parseInt(reviewingMatch.scoreA) || 0);
    const finalScoreB = Math.max(0, parseInt(reviewingMatch.scoreB) || 0);

    const { goalsA: evGoalsA, goalsB: evGoalsB } = calculateEventsGoals(
      reviewingMatch.events || [],
      reviewingMatch.home,
      reviewingMatch.away
    );

    if (finalScoreA !== evGoalsA || finalScoreB !== evGoalsB) {
      toast.error(
        `⚠️ TỈ SỐ CHƯA KHỚP VỚI SỰ KIỆN GHI BÀN!\n- Đội ${reviewingMatch.home}: Tỉ số là ${finalScoreA} nhưng chỉ có ${evGoalsA} sự kiện bàn thắng.\n- Đội ${reviewingMatch.away}: Tỉ số là ${finalScoreB} nhưng chỉ có ${evGoalsB} sự kiện bàn thắng.\nVui lòng thêm cầu thủ ghi bàn cho đủ hoặc bấm "Đồng bộ tỉ số"!`
      );
      return;
    }

    if (reviewingMatch.group === 'Vòng Knock-out' && !reviewingMatch.advancingTeam && !reviewingMatch.round?.includes('Tranh Hạng 3')) {
      toast.warning('Vui lòng chọn ĐỘI GIÀNH QUYỀN ĐI TIẾP cho trận Knock-out!');
      return;
    }

    update(ref(db, `matches/${reviewingMatch.id}`), {
      status: 'Đã xong',
      scoreA: finalScoreA,
      scoreB: finalScoreB,
      penA: reviewingMatch.penA !== undefined && reviewingMatch.penA !== '' ? Math.max(0, parseInt(reviewingMatch.penA) || 0) : '',
      penB: reviewingMatch.penB !== undefined && reviewingMatch.penB !== '' ? Math.max(0, parseInt(reviewingMatch.penB) || 0) : '',
      events: reviewingMatch.events || [],
      rejectReason: '',
      advancingTeam: reviewingMatch.advancingTeam || ''
    });

    toast.success('✅ Đã phê duyệt và chốt kết quả trận đấu thành công!');
    setReviewingMatch(null);
  };

  const handleRejectMatch = () => {
    const reason = window.prompt('Nhập lý do từ chối để Thư ký nắm được và sửa lại:');
    if (reason) {
      update(ref(db, `matches/${reviewingMatch.id}`), {
        status: 'Bị từ chối',
        rejectReason: reason
      });
      toast.info('Đã trả biên bản về cho Thư ký');
      setReviewingMatch(null);
    }
  };

  // ==========================================
  // 7. QUẢN LÝ CẦU THỦ & PROMPT AI
  // ==========================================
  const handleAddSinglePlayer = () => {
    if (!newPlayer.team || !newPlayer.num || !newPlayer.name) {
      toast.warning('Vui lòng chọn Đội, nhập Số áo và Tên thật!');
      return;
    }

    const teamPlayers = players[newPlayer.team] || [];
    set(ref(db, `players/${newPlayer.team}`), [...teamPlayers, { ...newPlayer }]);
    setNewPlayer({ ...newPlayer, num: '', name: '', shirtName: '' });
    toast.success('Đã thêm 1 cầu thủ vào đội hình!');
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!newPlayer.team) {
      toast.warning('Vui lòng Chọn Đội ở ô bên trên trước khi tải file JSON!');
      return;
    }

    if (!window.confirm(`⚠️ BẠN CÓ CHẮC CHẮN? \nHành động này sẽ XÓA SẠCH danh sách hiện tại của đội [${newPlayer.team}] và GHI ĐÈ bằng danh sách mới trong file JSON.`)) {
      e.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
        const imported = json.map((p) => ({
          team: newPlayer.team,
          num: p.soAo || p.num,
          name: p.ten || p.name,
          shirtName: p.tenAo || p.shirtName || p.ten || p.name,
          avatar: p.avatar || ''
        }));

        set(ref(db, `players/${newPlayer.team}`), imported);
        toast.success(`✅ Đã GHI ĐÈ ${imported.length} cầu thủ vào đội ${newPlayer.team}!`);
        e.target.value = null;
      } catch {
        toast.error('File JSON không đúng định dạng!');
      }
    };
    reader.readAsText(file);
  };

  const handleCopyText = (text, msg) => {
    navigator.clipboard.writeText(text);
    toast.success(msg || 'Đã sao chép vào bộ nhớ tạm!');
  };

  const handleDownloadSampleFile = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(SAMPLE_JSON_SNIPPET);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'template_cauthu.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Đã tải xuống file template_cauthu.json!');
  };

  const handleSaveTeamEdit = () => {
    if (!editTeam) return;
    set(ref(db, `players/${editTeam}`), editingPlayers);
    toast.success(`Đã lưu danh sách đội hình ${editTeam}!`);
  };

  const pendingApprovals = matches.filter((m) => m.status === 'Chờ duyệt');
  const allTeamsList = groupsData.flatMap((g) => g.teams || []);

  const groupStageFinished = isGroupStageFinished(matches);
  const currentKnockoutFormat = tourConfig.knockoutFormat || 'quarter';
  const qualifyCount = getQualifyingCount(currentKnockoutFormat, groupsData.length);

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

  return (
    <div className="app-container animate-fade-in">
      {/* Top Tabs */}
      <div className="card mb16" style={{ padding: '8px 12px' }}>
        <div className="navbar-nav" style={{ background: 'transparent', border: 'none' }}>
          <button
            className={`nav-link ${adminTab === 'dieuhanh' ? 'active' : ''}`}
            onClick={() => setAdminTab('dieuhanh')}
          >
            <Settings size={16} />
            <span>⚙️ Điều Hành & Duyệt Biên Bản</span>
          </button>
          <button
            className={`nav-link ${adminTab === 'cauthu' ? 'active' : ''}`}
            onClick={() => setAdminTab('cauthu')}
          >
            <Users size={16} />
            <span>👥 Quản Lý Đội Hình</span>
          </button>
          <button
            className={`nav-link ${adminTab === 'xembxh' ? 'active' : ''}`}
            onClick={() => setAdminTab('xembxh')}
          >
            <Trophy size={16} />
            <span>📊 Xem BXH & Sơ Đồ</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ĐIỀU HÀNH & DUYỆT BIÊN BẢN */}
      {/* ======================================================== */}
      {adminTab === 'dieuhanh' && (
        <>
          {/* MODAL SỬA & DUYỆT BIÊN BẢN */}
          {reviewingMatch && (() => {
            const { goalsA: evGoalsA, goalsB: evGoalsB } = calculateEventsGoals(
              reviewingMatch.events || [],
              reviewingMatch.home,
              reviewingMatch.away
            );
            const currentScoreA = Math.max(0, parseInt(reviewingMatch.scoreA) || 0);
            const currentScoreB = Math.max(0, parseInt(reviewingMatch.scoreB) || 0);
            const isScoreMismatch = currentScoreA !== evGoalsA || currentScoreB !== evGoalsB;

            return (
              <div className="modal-backdrop animate-fade-in" onClick={() => setReviewingMatch(null)}>
                <div
                  className="modal-card modal-lg animate-scale-up"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="modal-header">
                    <div className="modal-title-group">
                      <span className="badge badge-pending">Duyệt Biên Bản Trận Đấu</span>
                      <h2 className="modal-title">{reviewingMatch.home} vs {reviewingMatch.away}</h2>
                    </div>
                    <button type="button" className="btn ghost icon-only" onClick={() => setReviewingMatch(null)}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="modal-body">
                    {/* Score Editing */}
                    <div className="match-banner">
                      <div className="scoreboard-container">
                        <div className="team-side home">
                          <div className="team-name">{reviewingMatch.home}</div>
                          <div className="text-dim" style={{ fontSize: '12px' }}>
                            Số bàn theo sự kiện: <b className="text-accent">{evGoalsA}</b>
                          </div>
                        </div>

                        <div className="score-center">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="number"
                              min="0"
                              className="input-dark"
                              style={{ width: '75px', textAlign: 'center', fontSize: '24px', fontWeight: 'bold' }}
                              value={reviewingMatch.scoreA ?? 0}
                              onChange={(e) => handleScoreChange('A', e.target.value)}
                            />
                            <span style={{ fontSize: '24px', fontWeight: 'bold' }}>:</span>
                            <input
                              type="number"
                              min="0"
                              className="input-dark"
                              style={{ width: '75px', textAlign: 'center', fontSize: '24px', fontWeight: 'bold' }}
                              value={reviewingMatch.scoreB ?? 0}
                              onChange={(e) => handleScoreChange('B', e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="team-side away">
                          <div className="team-name">{reviewingMatch.away}</div>
                          <div className="text-dim" style={{ fontSize: '12px' }}>
                            Số bàn theo sự kiện: <b className="text-accent">{evGoalsB}</b>
                          </div>
                        </div>
                      </div>

                      {/* Warning if Score doesn't match events */}
                      {isScoreMismatch && (
                        <div style={{ marginTop: '14px', padding: '12px 16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 'var(--radius-md)', textAlign: 'left' }}>
                          <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertTriangle size={16} /> Tỉ số chưa khớp với danh sách cầu thủ ghi bàn:
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#E2E8F0', marginTop: '4px' }}>
                            Tỉ số đã nhập là <b>{currentScoreA} - {currentScoreB}</b>, nhưng danh sách sự kiện mới ghi nhận <b>{evGoalsA} - {evGoalsB}</b> bàn.
                          </div>
                          <button
                            type="button"
                            className="btn small mt8"
                            style={{ background: 'var(--accent-gold)', color: '#000', fontWeight: 'bold' }}
                            onClick={handleSyncScoreFromEvents}
                          >
                            <Zap size={14} /> Tự động đặt tỉ số về ({evGoalsA} - {evGoalsB}) theo người ghi bàn
                          </button>
                        </div>
                      )}

                      {reviewingMatch.group === 'Vòng Knock-out' && (
                        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                          <span className="text-gold font-bold" style={{ fontSize: '13px' }}>Luân lưu (Pen):</span>
                          <input
                            type="number"
                            min="0"
                            className="input-dark"
                            style={{ width: '65px', textAlign: 'center' }}
                            placeholder="Pen A"
                            value={reviewingMatch.penA ?? ''}
                            onChange={(e) => setReviewingMatch({ ...reviewingMatch, penA: e.target.value })}
                          />
                          <span>-</span>
                          <input
                            type="number"
                            min="0"
                            className="input-dark"
                            style={{ width: '65px', textAlign: 'center' }}
                            placeholder="Pen B"
                            value={reviewingMatch.penB ?? ''}
                            onChange={(e) => setReviewingMatch({ ...reviewingMatch, penB: e.target.value })}
                          />
                        </div>
                      )}
                    </div>

                    {/* 🏆 BẮT BUỘC: CHỌN ĐỘI GIÀNH QUYỀN ĐI TIẾP (KNOCK-OUT) - ĐẶT NGAY ĐẦU TRỰC QUAN */}
                    {reviewingMatch.group === 'Vòng Knock-out' && (
                      <div className="ko-winner-selector-box">
                        <div className="flex-between mb12">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-gold)', fontWeight: '800', fontSize: '14px' }}>
                            <Trophy size={18} />
                            <span>BẮT BUỘC: CHỌN ĐỘI THẮNG / GIÀNH QUYỀN ĐI TIẾP (KNOCK-OUT)</span>
                          </div>
                          <span className="badge badge-accent-glow" style={{ fontSize: '11px' }}>
                            {reviewingMatch.advancingTeam ? `Đã chọn: ${reviewingMatch.advancingTeam}` : 'Chưa chọn đội đi tiếp'}
                          </span>
                        </div>

                        <div className="ko-winner-grid">
                          <div
                            className={`ko-winner-card ${reviewingMatch.advancingTeam === reviewingMatch.home ? 'selected' : ''}`}
                            onClick={() => setReviewingMatch({ ...reviewingMatch, advancingTeam: reviewingMatch.home })}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(0,255,135,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Shield size={20} className="text-accent" />
                              </div>
                              <div>
                                <div style={{ fontWeight: '800', fontSize: '15px' }}>{reviewingMatch.home}</div>
                                <div className="text-dim" style={{ fontSize: '12px' }}>Đội Nhà ({reviewingMatch.scoreA ?? 0} bàn)</div>
                              </div>
                            </div>
                            {reviewingMatch.advancingTeam === reviewingMatch.home ? (
                              <span className="badge badge-accent-glow" style={{ background: 'var(--accent-gold)', color: '#000', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Check size={14} /> ĐÃ CHỌN ĐI TIẾP
                              </span>
                            ) : (
                              <span className="btn ghost tiny" style={{ fontSize: '11.5px' }}>Bấm chọn thắng</span>
                            )}
                          </div>

                          <div
                            className={`ko-winner-card ${reviewingMatch.advancingTeam === reviewingMatch.away ? 'selected' : ''}`}
                            onClick={() => setReviewingMatch({ ...reviewingMatch, advancingTeam: reviewingMatch.away })}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(0,255,135,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Shield size={20} className="text-accent" />
                              </div>
                              <div>
                                <div style={{ fontWeight: '800', fontSize: '15px' }}>{reviewingMatch.away}</div>
                                <div className="text-dim" style={{ fontSize: '12px' }}>Đội Khách ({reviewingMatch.scoreB ?? 0} bàn)</div>
                              </div>
                            </div>
                            {reviewingMatch.advancingTeam === reviewingMatch.away ? (
                              <span className="badge badge-accent-glow" style={{ background: 'var(--accent-gold)', color: '#000', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Check size={14} /> ĐÃ CHỌN ĐI TIẾP
                              </span>
                            ) : (
                              <span className="btn ghost tiny" style={{ fontSize: '11.5px' }}>Bấm chọn thắng</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ➕ FORM BỔ SUNG SỰ KIỆN (BÀN THẮNG / THẺ PHẠT) */}
                    <div className="event-logger-box">
                      <div className="flex-between mb12">
                        <h4 style={{ color: 'var(--accent-green)', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                          <Plus size={16} /> Bổ sung sự kiện (Bàn thắng / Thẻ phạt) bị thiếu:
                        </h4>
                        <span className="text-dim" style={{ fontSize: '11.5px' }}>Tự động đồng bộ số bàn với tỉ số</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', alignItems: 'flex-end', marginBottom: '14px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11.5px' }}>Sự kiện:</label>
                          <select
                            className="select-dark"
                            style={{ padding: '7px 10px', fontSize: '12.5px' }}
                            value={revEvType}
                            onChange={(e) => {
                              setRevEvType(e.target.value);
                              setRevEvDetail(e.target.value === 'goal' ? 'normal' : 'Vàng');
                            }}
                          >
                            <option value="goal">⚽ Bàn Thắng</option>
                            <option value="card">🟨 / 🟥 Thẻ Phạt</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11.5px' }}>Chi tiết:</label>
                          {revEvType === 'goal' ? (
                            <select
                              className="select-dark"
                              style={{ padding: '7px 10px', fontSize: '12.5px' }}
                              value={revEvDetail}
                              onChange={(e) => setRevEvDetail(e.target.value)}
                            >
                              <option value="normal">Bàn thắng thường</option>
                              <option value="own">Phản lưới nhà (OG)</option>
                              <option value="pen">Penalty trong trận</option>
                            </select>
                          ) : (
                            <select
                              className="select-dark"
                              style={{ padding: '7px 10px', fontSize: '12.5px' }}
                              value={revEvDetail}
                              onChange={(e) => setRevEvDetail(e.target.value)}
                            >
                              <option value="Vàng">Thẻ Vàng 🟨</option>
                              <option value="Đỏ">Thẻ Đỏ 🟥</option>
                            </select>
                          )}
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11.5px' }}>Đội bóng:</label>
                          <select
                            className="select-dark"
                            style={{ padding: '7px 10px', fontSize: '12.5px' }}
                            value={revEvTeam}
                            onChange={(e) => {
                              setRevEvTeam(e.target.value);
                              setRevEvPlayer('');
                            }}
                          >
                            <option value="">-- Chọn Đội --</option>
                            <option value={reviewingMatch.home}>{reviewingMatch.home}</option>
                            <option value={reviewingMatch.away}>{reviewingMatch.away}</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                          <label className="form-label" style={{ fontSize: '11.5px' }}>Cầu thủ:</label>
                          {players[revEvTeam] && players[revEvTeam].length > 0 ? (
                            <select
                              className="select-dark"
                              style={{ padding: '7px 10px', fontSize: '12.5px' }}
                              value={revEvPlayer}
                              onChange={(e) => setRevEvPlayer(e.target.value)}
                              disabled={!revEvTeam}
                            >
                              <option value="">-- Chọn Cầu thủ --</option>
                              {players[revEvTeam].map((p) => (
                                <option key={p.num} value={`${p.num} - ${p.name}`}>
                                  #{p.num} - {p.name} {p.shirtName ? `(${p.shirtName})` : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              className="input-dark"
                              style={{ padding: '7px 10px', fontSize: '12.5px' }}
                              placeholder="Nhập tên cầu thủ (VD: #10 Văn A)..."
                              value={revEvPlayer}
                              onChange={(e) => setRevEvPlayer(e.target.value)}
                              disabled={!revEvTeam}
                            />
                          )}
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11.5px' }}>Phút:</label>
                          <input
                            type="text"
                            placeholder="VD: 20+1"
                            className="input-dark"
                            style={{ padding: '7px 10px', fontSize: '12.5px', textAlign: 'center' }}
                            value={revEvMin}
                            onChange={(e) => setRevEvMin(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="text-right">
                        <button type="button" className="btn green small" onClick={handleAddReviewEvent}>
                          <Plus size={15} /> Thêm Vào Biên Bản
                        </button>
                      </div>
                    </div>

                    {/* 📋 DANH SÁCH SỰ KIỆN CỦA TRẬN ĐẤU */}
                    <div className="card" style={{ background: '#090E16', border: '1px solid var(--border-card)', padding: '20px' }}>
                      <div className="flex-between mb14">
                        <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                          <FileText size={17} className="text-accent" />
                          <span>📋 DANH SÁCH SỰ KIỆN ĐÃ GHI NHẬN ({(reviewingMatch.events || []).length} SỰ KIỆN)</span>
                        </h4>
                      </div>

                      {(reviewingMatch.events || []).length === 0 ? (
                        <div className="event-empty-box">
                          <FileText size={28} className="text-dim" style={{ opacity: 0.5 }} />
                          <div style={{ color: 'var(--text-secondary)', fontWeight: '700', fontSize: '13.5px' }}>
                            Chưa có sự kiện bàn thắng hoặc thẻ phạt nào
                          </div>
                          <div className="text-dim" style={{ fontSize: '12px', maxWidth: '420px' }}>
                            Nếu trận đấu có bàn thắng hoặc thẻ phạt chưa được ghi nhận, vui lòng sử dụng khung <b>"Bổ sung sự kiện"</b> ở phía trên để thêm vào biên bản.
                          </div>
                        </div>
                      ) : (
                        <div className="table-container">
                          <table className="dpl-table">
                            <thead>
                              <tr style={{ background: '#060B12' }}>
                                <th style={{ width: '85px', textAlign: 'center' }}>PHÚT</th>
                                <th style={{ width: '140px' }}>LOẠI SỰ KIỆN</th>
                                <th style={{ width: '170px' }}>CHI TIẾT</th>
                                <th>CẦU THỦ</th>
                                <th style={{ width: '150px' }}>ĐỘI BÓNG</th>
                                <th style={{ textAlign: 'center', width: '60px' }}>XÓA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reviewingMatch.events.map((e) => (
                                <tr key={e.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                  <td style={{ textAlign: 'center' }}>
                                    <span className="event-minute-badge">
                                      {e.displayMinute || `${e.minute}'`}
                                    </span>
                                  </td>
                                  <td style={{ fontWeight: '700' }}>
                                    {e.type === 'goal' ? '⚽ Bàn thắng' : 'Thẻ phạt'}
                                  </td>
                                  <td>
                                    {e.detail === 'own' ? (
                                      <span className="badge" style={{ background: 'linear-gradient(135deg, #78350F, #92400E)', color: '#FEF3C7', fontWeight: '800' }}>
                                        PHẢN LƯỚI (OG)
                                      </span>
                                    ) : e.detail === 'pen' ? (
                                      <span className="badge" style={{ background: 'linear-gradient(135deg, #5B21B6, #4C1D95)', color: '#EDE9FE', fontWeight: '800' }}>
                                        PENALTY
                                      </span>
                                    ) : e.detail === 'Vàng' || e.detail === 'yellow' ? (
                                      <span className="badge" style={{ background: 'var(--accent-gold)', color: '#000', fontWeight: '800' }}>
                                        🟨 THẺ VÀNG
                                      </span>
                                    ) : e.detail === 'Đỏ' || e.detail === 'red' ? (
                                      <span className="badge" style={{ background: 'var(--accent-red)', color: '#fff', fontWeight: '800' }}>
                                        🟥 THẺ ĐỎ
                                      </span>
                                    ) : (
                                      <span className="badge badge-ghost">Bàn thắng thường</span>
                                    )}
                                  </td>
                                  <td style={{ fontWeight: '700', fontSize: '14px' }}>
                                    {cleanPlayerName(e.player)}
                                  </td>
                                  <td>
                                    <span style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>{e.team}</span>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      className="btn-delete-event"
                                      onClick={() => handleRemoveReviewEvent(e.id)}
                                      title="Xóa sự kiện này"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* 💬 GHI CHÚ TỪ THƯ KÝ BÀN */}
                    {reviewingMatch.secretaryNote && (
                      <div style={{ padding: '14px 18px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ color: '#60A5FA', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MessageSquare size={16} /> Ghi chú từ Thư Ký Bàn:
                        </div>
                        <div style={{ fontSize: '13px', color: '#E2E8F0', marginTop: '6px', fontStyle: 'italic' }}>
                          "{reviewingMatch.secretaryNote}"
                        </div>
                      </div>
                    )}

                    {/* ✍️ CHỮ KÝ ĐIỆN TỬ XÁC NHẬN */}
                    <div className="card" style={{ background: '#090E16', border: '1px solid var(--border-card)', padding: '20px' }}>
                      <div className="flex-between mb14">
                        <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                          <span>✍️ CHỮ KÝ ĐIỆN TỬ XÁC NHẬN (ĐỘI TRƯỞNG & TRỌNG TÀI)</span>
                        </h4>
                      </div>
                      <div className="signatures-display-grid">
                        <div className="signature-preview-card">
                          <div className="sig-preview-label">Đội trưởng {reviewingMatch.home}</div>
                          {reviewingMatch.signatures?.home ? (
                            <img src={reviewingMatch.signatures.home} className="sig-img" alt="sig" />
                          ) : (
                            <div className="sig-none">
                              <Edit size={20} style={{ opacity: 0.35 }} />
                              <span>Chưa có chữ ký</span>
                            </div>
                          )}
                        </div>
                        <div className="signature-preview-card">
                          <div className="sig-preview-label">Đội trưởng {reviewingMatch.away}</div>
                          {reviewingMatch.signatures?.away ? (
                            <img src={reviewingMatch.signatures.away} className="sig-img" alt="sig" />
                          ) : (
                            <div className="sig-none">
                              <Edit size={20} style={{ opacity: 0.35 }} />
                              <span>Chưa có chữ ký</span>
                            </div>
                          )}
                        </div>
                        <div className="signature-preview-card">
                          <div className="sig-preview-label">Trọng tài chính ({reviewingMatch.ref || 'Chưa ghi'})</div>
                          {reviewingMatch.signatures?.referee ? (
                            <img src={reviewingMatch.signatures.referee} className="sig-img" alt="sig" />
                          ) : (
                            <div className="sig-none">
                              <Edit size={20} style={{ opacity: 0.35 }} />
                              <span>Chưa có chữ ký</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={() => setPrintingMatch(reviewingMatch)}
                      title="In biên bản trận đấu A4"
                    >
                      <Printer size={15} /> In Biên Bản (A4)
                    </button>
                    <button type="button" className="btn danger" onClick={handleRejectMatch}>
                      <X size={16} /> Từ Chối (Trả về Thư ký)
                    </button>
                    <button type="button" className="btn green" onClick={handleSaveAndApprove}>
                      <Check size={16} /> Lưu & Duyệt Kết Quả
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Pending Matches & Discipline Cards */}
          {(tourStatus === 'active' || tourStatus === 'completed') && (
            <div className="grid-2 mb24">
              {/* Pending Approvals */}
              <div className="card" style={{ borderLeft: '4px solid var(--accent-gold)' }}>
                <div className="card-header">
                  <div className="card-title">
                    <CheckCircle2 size={18} className="text-gold" />
                    <span>Biên Bản Chờ Phê Duyệt</span>
                  </div>
                  <span className="badge badge-pending">{pendingApprovals.length} Trận</span>
                </div>

                {pendingApprovals.length === 0 ? (
                  <div className="empty-state-card">Không có biên bản nào đang chờ duyệt.</div>
                ) : (
                  <div className="table-container">
                    <table className="dpl-table">
                      <thead>
                        <tr>
                          <th>Cặp Đấu</th>
                          <th>Tỉ Số</th>
                          <th>Hành Động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingApprovals.map((p) => (
                          <tr key={p.id}>
                            <td style={{ fontWeight: '700' }}>{p.home} vs {p.away}</td>
                            <td className="text-accent font-bold">{p.scoreA} - {p.scoreB}</td>
                            <td>
                              <button className="btn green tiny" onClick={() => handleOpenReview(p)}>
                                Xem & Duyệt
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Discipline Alerts */}
              <div className="card" style={{ borderLeft: '4px solid var(--accent-red)' }}>
                <div className="card-header">
                  <div className="card-title">
                    <AlertTriangle size={18} className="text-red" />
                    <span>Cảnh Báo Kỷ Luật Tự Động</span>
                  </div>
                  <span className="badge badge-danger">{violations.length} Cảnh Báo</span>
                </div>

                {violations.length === 0 ? (
                  <div className="empty-state-card">Không có cảnh báo kỷ luật nào chưa xử lý.</div>
                ) : (
                  <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <table className="dpl-table">
                      <thead>
                        <tr>
                          <th>Cầu Thủ</th>
                          <th>Lỗi</th>
                          <th>Xử Lý</th>
                        </tr>
                      </thead>
                      <tbody>
                        {violations.map((v) => (
                          <tr key={v.key}>
                            <td>
                              <b>{v.player}</b> <span className="text-dim">({v.team})</span>
                            </td>
                            <td className="text-red font-bold" style={{ fontSize: '12px' }}>{v.reason}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button className="btn danger tiny" onClick={() => handleBanPlayer(v)}>
                                  Treo giò
                                </button>
                                <button className="btn ghost tiny" onClick={() => handlePardonWarning(v)}>
                                  Ân xá
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active Suspensions */}
          {Object.keys(suspensions).length > 0 && (
            <div className="card mb24" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <div className="card-header">
                <div className="card-title text-red">
                  <AlertOctagon size={18} />
                  <span>Danh Sách Cầu Thủ Đang Bị Cấm Thi Đấu ({Object.keys(suspensions).length})</span>
                </div>
              </div>

              <div className="grid-auto">
                {Object.entries(suspensions).map(([pKey, data]) => {
                  const team = pKey.split('@@')[0];
                  const player = pKey.split('@@')[1];

                  return (
                    <div
                      key={pKey}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700', color: 'var(--accent-red)' }}>{player}</div>
                        <div className="text-dim" style={{ fontSize: '11px' }}>{team} • {data.reason}</div>
                      </div>
                      <button
                        className="btn ghost tiny"
                        style={{ color: 'var(--accent-green)' }}
                        onClick={() => handleRemoveActiveBan(pKey, player)}
                      >
                        Gỡ án phạt
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tournament Lifecycle Management */}
          <div className="card mb24">
            <div className="card-header">
              <div className="card-title">
                <Trophy size={18} className="text-accent" />
                <span>Quản Trị Mùa Giải: {tourConfig.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {tourStatus === 'active' && (
                  <button className="btn warning small" onClick={handleCompleteTour}>
                    Khép Lại Mùa Giải
                  </button>
                )}
                {tourStatus !== 'none' && (
                  <button className="btn danger small" onClick={handleDeleteTour}>
                    Xóa / Reset Giải
                  </button>
                )}
              </div>
            </div>

            {tourStatus === 'none' && (
              <div className="text-center" style={{ padding: '30px' }}>
                <button className="btn green" onClick={() => set(ref(db, 'tourStatus'), 'config')}>
                  <Plus size={16} /> BẮT ĐẦU TẠO GIẢI ĐẤU MỚI
                </button>
              </div>
            )}

            {tourStatus === 'config' && (
              <div className="animate-fade-in">
                <div className="grid-auto mb16">
                  <div className="form-group">
                    <label className="form-label">Tên Giải Đấu:</label>
                    <input
                      type="text"
                      className="input-dark"
                      value={tourConfig.name}
                      onChange={(e) => setTourConfig({ ...tourConfig, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Thể thức thi đấu:</label>
                    <select
                      className="select-dark"
                      value={tourConfig.format}
                      onChange={(e) => setTourConfig({ ...tourConfig, format: e.target.value })}
                    >
                      <option value="group">Chia Bảng Đấu (Vòng bảng + Knock-out)</option>
                      <option value="league">Đá Vòng Tròn Tính Điểm (League)</option>
                    </select>
                  </div>

                  {tourConfig.format === 'group' && (
                    <div className="form-group">
                      <label className="form-label">Số Lượng Bảng:</label>
                      <input
                        type="number"
                        className="input-dark"
                        min="2"
                        max="8"
                        value={tourConfig.numGroups}
                        onChange={(e) => setTourConfig({ ...tourConfig, numGroups: Number(e.target.value) })}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Thời lượng 1 hiệp (phút):</label>
                    <input
                      type="number"
                      className="input-dark"
                      min="10"
                      max="60"
                      value={tourConfig.halfDuration || 20}
                      onChange={(e) => setTourConfig({ ...tourConfig, halfDuration: Number(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cơ cấu Knock-out bắt đầu từ:</label>
                    <select
                      className="select-dark"
                      value={tourConfig.knockoutFormat || 'quarter'}
                      onChange={(e) => setTourConfig({ ...tourConfig, knockoutFormat: e.target.value })}
                    >
                      <option value="quarter">🏆 Bắt đầu từ TỨ KẾT (Mỗi bảng lấy 4 đội đầu)</option>
                      <option value="semi">🏆 Bắt đầu từ BÁN KẾT (Mỗi bảng lấy 2 đội đầu)</option>
                    </select>
                  </div>
                </div>

                <button type="button" className="btn green" onClick={handleGoToSetupTeams}>
                  Tiếp Tục Điền Đội Bóng ➔
                </button>
              </div>
            )}

            {tourStatus === 'setup_teams' && (
              <div className="animate-fade-in">
                <div className="text-dim mb16" style={{ fontSize: '13px' }}>
                  Thêm các đội bóng tham gia vào từng bảng đấu (Nhập tên đội và bấm Thêm):
                </div>

                <div className="grid-auto mb24">
                  {groupsData.map((g, idx) => (
                    <div key={idx} className="card" style={{ background: 'var(--bg-secondary)', padding: '16px' }}>
                      <h4 className="mb12" style={{ color: 'var(--accent-green)' }}>{g.groupName}</h4>
                      <div className="flex-row mb12">
                        <input
                          type="text"
                          className="input-dark"
                          placeholder="Tên đội..."
                          value={teamInputs[idx] || ''}
                          onChange={(e) => setTeamInputs({ ...teamInputs, [idx]: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTeamToGroup(idx)}
                        />
                        <button className="btn green small" onClick={() => handleAddTeamToGroup(idx)}>
                          + Thêm
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(g.teams || []).map((tName) => (
                          <div
                            key={tName}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'var(--bg-card)',
                              padding: '8px 12px',
                              borderRadius: '4px',
                              fontSize: '13px'
                            }}
                          >
                            <span style={{ fontWeight: '600' }}>{tName}</span>
                            <button
                              className="btn danger tiny"
                              onClick={() => handleRemoveTeam(idx, tName)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex-between">
                  <button className="btn ghost" onClick={() => set(ref(db, 'tourStatus'), 'config')}>
                    Quay lại Cấu hình
                  </button>
                  <button className="btn green" onClick={generateSchedule}>
                    Sinh Lịch Vòng Bảng ➔
                  </button>
                </div>
              </div>
            )}

            {(tourStatus === 'draft' || tourStatus === 'active' || tourStatus === 'completed') && (
              <div>
                <div className="flex-between mb16">
                  <div className="card-title" style={{ fontSize: '15px' }}>
                    <span>📅 Lịch Thi Đấu Tổng Thể ({matches.length} trận)</span>
                  </div>
                  {tourStatus === 'draft' && (
                    <button className="btn green" onClick={handlePublishTournament}>
                      <Sparkles size={16} /> ✅ CHỐT LỊCH & KHỞI TRANH GIẢI ĐẤU
                    </button>
                  )}
                </div>

                <div className="table-container mb16">
                  <table className="dpl-table">
                    <thead>
                      <tr>
                        <th>Vòng / Bảng</th>
                        <th>Cặp Đấu</th>
                        <th>Tỉ Số</th>
                        <th>Ngày Giờ</th>
                        <th>Trọng Tài</th>
                        <th>Thư Ký</th>
                        <th>Trạng Thái</th>
                        <th>Sửa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((m) => (
                        <tr key={m.id}>
                          <td><span className="badge badge-ghost">{m.round || m.group}</span></td>
                          <td style={{ fontWeight: '700' }}>{m.home} vs {m.away}</td>
                          <td className="text-accent font-bold">
                            {m.status === 'Đã xong' || m.status === 'Đang LIVE' ? `${m.scoreA} - ${m.scoreB}` : '—'}
                          </td>
                          <td>
                            {tourStatus !== 'completed' ? (
                              <input
                                type="datetime-local"
                                className="input-dark"
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                                value={m.date || ''}
                                onChange={(e) => update(ref(db, `matches/${m.id}`), { date: e.target.value })}
                              />
                            ) : (
                              formatDateTime(m.date)
                            )}
                          </td>
                          <td>
                            {tourStatus !== 'completed' ? (
                              <input
                                type="text"
                                className="input-dark"
                                style={{ padding: '4px 8px', fontSize: '12px', width: '100px' }}
                                defaultValue={m.ref || ''}
                                onBlur={(e) => update(ref(db, `matches/${m.id}`), { ref: e.target.value })}
                              />
                            ) : (
                              m.ref || '—'
                            )}
                          </td>
                          <td>
                            {tourStatus !== 'completed' ? (
                              <input
                                type="text"
                                className="input-dark"
                                style={{ padding: '4px 8px', fontSize: '12px', width: '100px' }}
                                defaultValue={m.sec || ''}
                                onBlur={(e) => update(ref(db, `matches/${m.id}`), { sec: e.target.value })}
                              />
                            ) : (
                              m.sec || '—'
                            )}
                          </td>
                          <td><span className="badge badge-ghost">{m.status}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button className="btn ghost tiny" onClick={() => handleOpenReview(m)}>
                                Sửa
                              </button>
                              {m.status === 'Đã xong' && (
                                <button
                                  type="button"
                                  className="btn ghost tiny"
                                  onClick={() => setPrintingMatch(m)}
                                  title="In biên bản trận đấu A4"
                                  style={{ color: 'var(--accent-green)' }}
                                >
                                  <Printer size={12} /> In
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* QUẢN TRỊ TIẾN TRÌNH VÒNG KNOCK-OUT (CHỈ TẠO 1 LẦN) */}
          {/* ======================================================== */}
          {tourStatus === 'active' && (
            <div className="card mb24">
              <div className="card-header">
                <div className="card-title">
                  <Trophy size={18} className="text-gold" />
                  <span>Tiến Trình Nhánh Đấu Vòng Knock-out</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {koMatches.length > 0 && (
                    <button
                      type="button"
                      className="btn ghost tiny"
                      style={{ color: 'var(--accent-red)' }}
                      onClick={handleResetKnockoutBranch}
                      title="Xóa toàn bộ các trận Knock-out để thiết lập lại từ đầu"
                    >
                      <RotateCcw size={12} /> Thiết lập lại từ đầu
                    </button>
                  )}
                  {groupStageFinished ? (
                    <span className="badge badge-done">✅ Vòng bảng đã xong</span>
                  ) : (
                    <span className="badge badge-pending">⏳ Vòng bảng đang diễn ra</span>
                  )}
                </div>
              </div>

              {/* TRƯỜNG HỢP 1: CHƯA TẠO NHÁNH KNOCK-OUT NÀO -> CHO PHÉP TẠO 1 LẦN DUY NHẤT */}
              {koMatches.length === 0 ? (
                koStep === 1 ? (
                  <div>
                    <h4 className="mb12" style={{ color: 'var(--accent-green)', fontSize: '14px' }}>
                      Chọn cơ cấu bắt đầu cho vòng Knock-out (Chỉ thiết lập 1 lần lúc đầu):
                    </h4>

                    <div className="grid-2 mb16">
                      {/* Option 1: Tứ Kết */}
                      <div
                        className="card cursor-pointer"
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid rgba(0,255,135,0.3)',
                          padding: '18px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '20px' }}>🥇</span>
                            <h4 style={{ fontSize: '16px', fontWeight: '800' }}>Bắt Đầu Từ TỨ KẾT (8 Đội)</h4>
                          </div>
                          <p className="text-dim" style={{ fontSize: '13px', lineHeight: '1.5' }}>
                            Mỗi bảng lấy <b>4 đội đứng đầu</b>. Tạo 4 trận Tứ Kết ➔ khi xong tự động mở Bán Kết ➔ tiếp theo là Chung Kết & Tranh Hạng 3.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn green small mt16"
                          onClick={() => handleStartKoWizard('quarter')}
                        >
                          Thiết Lập Tứ Kết (8 Đội) ➔
                        </button>
                      </div>

                      {/* Option 2: Bán Kết */}
                      <div
                        className="card cursor-pointer"
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid rgba(245,158,11,0.3)',
                          padding: '18px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '20px' }}>🥈</span>
                            <h4 style={{ fontSize: '16px', fontWeight: '800' }}>Bắt Đầu Từ BÁN KẾT (4 Đội)</h4>
                          </div>
                          <p className="text-dim" style={{ fontSize: '13px', lineHeight: '1.5' }}>
                            Mỗi bảng lấy <b>2 đội đứng đầu</b>. Tạo 2 trận Bán Kết ➔ khi xong tự động mở Chung Kết & Tranh Hạng 3.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn warning small mt16"
                          onClick={() => handleStartKoWizard('semi')}
                        >
                          Thiết Lập Bán Kết (4 Đội) ➔
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex-between mb16">
                      <h4 style={{ color: 'var(--accent-green)', fontSize: '15px' }}>
                        Thiết lập các cặp đấu khởi đầu cho {koRoundName}:
                      </h4>
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={handleAutoFillFromStandings}
                      >
                        <Zap size={14} className="text-gold" /> Tự động điền theo thứ hạng BXH
                      </button>
                    </div>

                    <div className="grid-auto mb16">
                      {koMatchesForm.map((m, idx) => (
                        <div key={idx} className="card" style={{ background: 'var(--bg-secondary)', padding: '16px' }}>
                          <div className="badge badge-accent-glow mb12">
                            {m.label || `Trận ${idx + 1}`}
                          </div>

                          <div className="form-group">
                            <label className="form-label">Đội Nhà:</label>
                            <select
                              className="select-dark"
                              value={m.home}
                              onChange={(e) => {
                                const updated = [...koMatchesForm];
                                updated[idx].home = e.target.value;
                                setKoMatchesForm(updated);
                              }}
                            >
                              <option value="">-- Chọn Đội Nhà --</option>
                              {allTeamsList.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Đội Khách:</label>
                            <select
                              className="select-dark"
                              value={m.away}
                              onChange={(e) => {
                                const updated = [...koMatchesForm];
                                updated[idx].away = e.target.value;
                                setKoMatchesForm(updated);
                              }}
                            >
                              <option value="">-- Chọn Đội Khách --</option>
                              {allTeamsList.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Ngày Giờ Thi Đấu:</label>
                            <input
                              type="datetime-local"
                              className="input-dark"
                              value={m.date}
                              onChange={(e) => {
                                const updated = [...koMatchesForm];
                                updated[idx].date = e.target.value;
                                setKoMatchesForm(updated);
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex-between">
                      <button className="btn ghost" onClick={() => setKoStep(1)}>
                        Quay lại chọn thể thức
                      </button>
                      <button className="btn green" onClick={handleCreateKnockoutMatches}>
                        <Check size={16} /> Lưu & Đẩy Lịch {koRoundName}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                /* TRƯỜNG HỢP 2: ĐÃ CÓ TRẬN KNOCK-OUT -> HIỂN THỊ TIẾN ĐỘ & NÚT SINH VÒNG KẾ TIẾP */
                <div>
                  {/* Stage 1: Tứ Kết Progress (nếu có Tứ Kết) */}
                  {qfMatches.length > 0 && (
                    <div className="card mb16" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-card)', padding: '16px' }}>
                      <div className="flex-between mb12">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '18px' }}>🥇</span>
                          <h4 style={{ fontWeight: '800', fontSize: '15px' }}>Vòng Tứ Kết (4 Trận)</h4>
                        </div>
                        <span className={`badge ${qfDoneCount === 4 ? 'badge-done' : 'badge-pending'}`}>
                          {qfDoneCount === 4 ? '✅ Đã hoàn thành 4/4 trận' : `⏳ Đang thi đấu (${qfDoneCount}/4 trận xong)`}
                        </span>
                      </div>

                      {/* Nút Tạo Bán Kết khi xong 4 trận Tứ Kết */}
                      {qfDoneCount === 4 && sfMatches.length === 0 && (
                        <div style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(0, 255, 135, 0.12) 0%, rgba(245, 158, 11, 0.08) 100%)', border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-md)', marginTop: '12px' }}>
                          <div className="flex-between">
                            <div>
                              <div style={{ fontWeight: '800', color: 'var(--accent-green)', fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Sparkles size={18} /> Đã xác định 4 đội chiến thắng Tứ Kết!
                              </div>
                              <div className="text-dim" style={{ fontSize: '12.5px', marginTop: '4px' }}>
                                • BK1: <b>{qfMatches[0]?.advancingTeam}</b> vs <b>{qfMatches[1]?.advancingTeam}</b><br />
                                • BK2: <b>{qfMatches[2]?.advancingTeam}</b> vs <b>{qfMatches[3]?.advancingTeam}</b>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn green"
                              onClick={handleCreateSemiFinals}
                            >
                              <Zap size={16} /> ⚡ TẠO 2 TRẬN BÁN KẾT NGAY ➔
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stage 2: Bán Kết Progress (nếu có Bán Kết) */}
                  {sfMatches.length > 0 && (
                    <div className="card mb16" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-card)', padding: '16px' }}>
                      <div className="flex-between mb12">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '18px' }}>🥈</span>
                          <h4 style={{ fontWeight: '800', fontSize: '15px' }}>Vòng Bán Kết (2 Trận)</h4>
                        </div>
                        <span className={`badge ${sfDoneCount === 2 ? 'badge-done' : 'badge-pending'}`}>
                          {sfDoneCount === 2 ? '✅ Đã hoàn thành 2/2 trận' : `⏳ Đang thi đấu (${sfDoneCount}/2 trận xong)`}
                        </span>
                      </div>

                      {/* Nút Tạo Chung Kết & Tranh Hạng 3 khi xong 2 trận Bán Kết */}
                      {sfDoneCount === 2 && (finalMatches.length === 0 || thirdMatches.length === 0) && (
                        <div style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.08) 100%)', border: '1px solid var(--accent-gold)', borderRadius: 'var(--radius-md)', marginTop: '12px' }}>
                          <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                              <div style={{ fontWeight: '800', color: 'var(--accent-gold)', fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Trophy size={18} /> Đã có 2 đội vào Chung Kết & 2 đội Tranh Hạng Ba!
                              </div>
                              <div style={{ fontSize: '13px', marginTop: '6px', color: '#FFFFFF' }}>
                                • 🥇🥈 <b>Chung Kết (Vô Địch & Á Quân):</b> {sfMatches[0]?.advancingTeam} vs {sfMatches[1]?.advancingTeam}<br />
                                • 🥉 <b>Tranh Hạng Ba:</b> {sfMatches[0]?.home === sfMatches[0]?.advancingTeam ? sfMatches[0]?.away : sfMatches[0]?.home} vs {sfMatches[1]?.home === sfMatches[1]?.advancingTeam ? sfMatches[1]?.away : sfMatches[1]?.home}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn warning"
                              style={{ fontWeight: '800', color: '#000' }}
                              onClick={handleCreateFinalsAndThirdPlace}
                            >
                              <Trophy size={16} /> 🏆 TẠO TRẬN CHUNG KẾT & TRANH 3-4 ➔
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stage 3: Chung Kết & Tranh Hạng 3 Progress */}
                  {(finalMatches.length > 0 || thirdMatches.length > 0) && (
                    <div className="card mb16" style={{ background: 'linear-gradient(135deg, #0E1624 0%, #152236 100%)', border: '1px solid var(--accent-gold)', padding: '18px' }}>
                      <div className="flex-between mb12">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Trophy size={20} className="text-gold" />
                          <h4 style={{ fontWeight: '800', fontSize: '16px', color: 'var(--accent-gold)' }}>
                            Vòng Chung Kết & Tranh Hạng Ba
                          </h4>
                        </div>
                        <span className={`badge ${finalDone && thirdDone ? 'badge-done' : 'badge-pending'}`}>
                          {finalDone && thirdDone ? '🏆 MÙA GIẢI ĐÃ XÁC ĐỊNH NHÀ VÔ ĐỊCH' : '⏳ Đang chờ kết quả chung cuộc'}
                        </span>
                      </div>

                      {/* Bục vinh danh nếu đã hoàn tất cả 2 trận */}
                      {finalDone && thirdDone && (
                        <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                          <div style={{ fontSize: '24px', marginBottom: '4px' }}>🎉 🏆 🥇 🥈 🥉 🎉</div>
                          <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--accent-gold)' }}>
                            KẾT QUẢ CHUNG CUỘC MÙA GIẢI
                          </h3>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px', flexWrap: 'wrap' }}>
                            <div style={{ background: 'rgba(0,255,135,0.1)', padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--accent-green)' }}>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>🥇 VÔ ĐỊCH</div>
                              <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--accent-green)' }}>
                                {finalMatches[0]?.advancingTeam}
                              </div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 18px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)' }}>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>🥈 Á QUÂN</div>
                              <div style={{ fontSize: '16px', fontWeight: '800' }}>
                                {finalMatches[0]?.home === finalMatches[0]?.advancingTeam ? finalMatches[0]?.away : finalMatches[0]?.home}
                              </div>
                            </div>
                            <div style={{ background: 'rgba(245,158,11,0.1)', padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--accent-gold)' }}>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>🥉 HẠNG BA</div>
                              <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--accent-gold)' }}>
                                {thirdMatches[0]?.advancingTeam}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* TAB 2: QUẢN LÝ ĐỘI HÌNH & IMPORT JSON & PROMPT AI */}
      {/* ======================================================== */}
      {adminTab === 'cauthu' && (
        <section className="animate-fade-in">
          <div className="card mb16">
            <div className="card-header">
              <div className="card-title">
                <Users size={18} className="text-accent" />
                <span>Quản Lý Danh Sách Cầu Thủ & Đội Hình</span>
              </div>
              <div className="navbar-nav" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                <button
                  className={`nav-link ${playerTab === 'upload' ? 'active' : ''}`}
                  onClick={() => setPlayerTab('upload')}
                >
                  <Upload size={14} /> Thêm Mới / Ghi Đè JSON
                </button>
                <button
                  className={`nav-link ${playerTab === 'edit' ? 'active' : ''}`}
                  onClick={() => setPlayerTab('edit')}
                >
                  <Edit size={14} /> Chỉnh Sửa & Avatar
                </button>
              </div>
            </div>

            {playerTab === 'upload' && (
              <div className="animate-fade-in">
                {/* 1. Download Helper */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={handleDownloadSampleFile}
                  >
                    <Download size={15} /> Tải File Mẫu (template_cauthu.json)
                  </button>
                </div>

                <div className="form-group" style={{ maxWidth: '360px' }}>
                  <label className="form-label">Chọn Đội Bóng Cần Nạp Danh Sách:</label>
                  <select
                    className="select-dark"
                    value={newPlayer.team}
                    onChange={(e) => setNewPlayer({ ...newPlayer, team: e.target.value })}
                  >
                    <option value="">-- Chọn Đội --</option>
                    {allTeamsList.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Import JSON Overwrite box */}
                <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed rgba(239, 68, 68, 0.4)', borderRadius: 'var(--radius-md)', marginBottom: '24px' }}>
                  <div style={{ color: 'var(--accent-red)', fontWeight: 'bold', fontSize: '13.5px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} /> Tải file JSON (GHI ĐÈ 100% DANH SÁCH HIỆN TẠI):
                  </div>
                  <p className="text-dim mb12" style={{ fontSize: '12.5px' }}>
                    Chọn file <code>.json</code> chứa danh sách cầu thủ của đội đã chọn ở trên.
                  </p>
                  <label className={`btn ghost ${!newPlayer.team ? 'disabled' : ''}`} style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)', cursor: newPlayer.team ? 'pointer' : 'not-allowed' }}>
                    <Upload size={16} /> Chọn File JSON Cầu Thủ Của Đội
                    <input type="file" accept=".json" style={{ display: 'none' }} disabled={!newPlayer.team} onChange={handleImportJSON} />
                  </label>
                </div>

                {/* AI Prompt & JSON Structure Helpers */}
                <div className="grid-2 mb24">
                  {/* JSON Template Box */}
                  <div className="card" style={{ background: 'var(--bg-secondary)', padding: '16px' }}>
                    <div className="flex-between mb8">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', fontSize: '13.5px', color: 'var(--accent-green)' }}>
                        <FileCode size={16} /> Mẫu Cấu Trúc JSON Chuẩn:
                      </div>
                      <button
                        type="button"
                        className="btn ghost tiny"
                        onClick={() => handleCopyText(SAMPLE_JSON_SNIPPET, 'Đã sao chép Mẫu JSON!')}
                      >
                        <Copy size={12} /> Sao chép mẫu
                      </button>
                    </div>
                    <pre style={{ background: '#070C12', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '11.5px', color: '#A7F3D0', overflowX: 'auto', margin: 0 }}>
                      {SAMPLE_JSON_SNIPPET}
                    </pre>
                  </div>

                  {/* AI Prompt Template Box */}
                  <div className="card" style={{ background: 'var(--bg-secondary)', padding: '16px' }}>
                    <div className="flex-between mb8">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', fontSize: '13.5px', color: 'var(--accent-gold)' }}>
                        <Bot size={16} /> Prompt Mẫu Dùng Cho AI (ChatGPT / Gemini):
                      </div>
                      <button
                        type="button"
                        className="btn ghost tiny"
                        onClick={() => handleCopyText(AI_PROMPT_TEMPLATE, 'Đã sao chép Prompt AI!')}
                      >
                        <Copy size={12} /> Sao chép Prompt
                      </button>
                    </div>
                    <p className="text-dim mb8" style={{ fontSize: '12px' }}>
                      Sao chép câu lệnh này dán vào AI cùng danh sách thô từ Excel/Zalo để AI tự xuất file JSON chuẩn:
                    </p>
                    <div style={{ background: '#070C12', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '11.5px', color: '#E2E8F0', maxHeight: '110px', overflowY: 'auto' }}>
                      "{AI_PROMPT_TEMPLATE.slice(0, 180)}..."
                    </div>
                  </div>
                </div>

                {/* Manual Add */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
                  <h4 className="mb12" style={{ color: 'var(--accent-green)', fontSize: '14px' }}>
                    Hoặc thêm thủ công từng cầu thủ (Cộng dồn):
                  </h4>

                  <div className="grid-auto mb16">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Số áo:</label>
                      <input
                        type="number"
                        className="input-dark"
                        placeholder="VD: 7"
                        value={newPlayer.num}
                        onChange={(e) => setNewPlayer({ ...newPlayer, num: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Tên thật cầu thủ:</label>
                      <input
                        type="text"
                        className="input-dark"
                        placeholder="Họ và tên..."
                        value={newPlayer.name}
                        onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Tên in sau lưng áo:</label>
                      <input
                        type="text"
                        className="input-dark"
                        placeholder="Tên áo..."
                        value={newPlayer.shirtName}
                        onChange={(e) => setNewPlayer({ ...newPlayer, shirtName: e.target.value })}
                      />
                    </div>
                  </div>

                  <button className="btn green" onClick={handleAddSinglePlayer}>
                    <Plus size={16} /> Thêm Cầu Thủ
                  </button>
                </div>
              </div>
            )}

            {playerTab === 'edit' && (
              <div className="animate-fade-in">
                <div className="form-group mb16" style={{ maxWidth: '360px' }}>
                  <label className="form-label">Chọn Đội để chỉnh sửa:</label>
                  <select
                    className="select-dark"
                    value={editTeam}
                    onChange={(e) => handleSelectEditTeam(e.target.value)}
                  >
                    <option value="">-- Chọn Đội --</option>
                    {allTeamsList.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {editTeam && (
                  <div>
                    <div className="table-container mb16">
                      <table className="dpl-table">
                        <thead>
                          <tr>
                            <th style={{ width: '60px' }}>Ảnh</th>
                            <th style={{ width: '80px' }}>Số Áo</th>
                            <th>Họ và Tên Thật</th>
                            <th>Tên In Trên Áo</th>
                            <th>Link Avatar URL</th>
                            <th style={{ textAlign: 'center', width: '50px' }}>Xóa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editingPlayers.length === 0 ? (
                            <tr><td colSpan="6" className="text-center text-dim">Đội này chưa có cầu thủ</td></tr>
                          ) : (
                            editingPlayers.map((p, idx) => (
                              <tr key={idx}>
                                <td>
                                  {p.avatar ? (
                                    <img src={p.avatar} alt="avt" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--accent-green)' }} />
                                  ) : (
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                                      #{p.num}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="input-dark"
                                    style={{ width: '60px', padding: '4px 8px', textAlign: 'center' }}
                                    value={p.num}
                                    onChange={(e) => {
                                      const updated = [...editingPlayers];
                                      updated[idx].num = e.target.value;
                                      setEditingPlayers(updated);
                                    }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="input-dark"
                                    style={{ padding: '4px 8px' }}
                                    value={p.name}
                                    onChange={(e) => {
                                      const updated = [...editingPlayers];
                                      updated[idx].name = e.target.value;
                                      setEditingPlayers(updated);
                                    }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="input-dark"
                                    style={{ padding: '4px 8px' }}
                                    value={p.shirtName || ''}
                                    onChange={(e) => {
                                      const updated = [...editingPlayers];
                                      updated[idx].shirtName = e.target.value;
                                      setEditingPlayers(updated);
                                    }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="input-dark"
                                    placeholder="https://..."
                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                    value={p.avatar || ''}
                                    onChange={(e) => {
                                      const updated = [...editingPlayers];
                                      updated[idx].avatar = e.target.value;
                                      setEditingPlayers(updated);
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    className="btn danger tiny"
                                    onClick={() => setEditingPlayers(editingPlayers.filter((_, i) => i !== idx))}
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

                    <div className="text-right">
                      <button className="btn green" onClick={handleSaveTeamEdit}>
                        <Check size={16} /> Lưu Lại Danh Sách Đội {editTeam}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* TAB 3: XEM BXH & SƠ ĐỒ KNOCK-OUT */}
      {/* ======================================================== */}
      {adminTab === 'xembxh' && (
        <section className="animate-fade-in">
          <div className="card mb24">
            <div className="card-header">
              <div className="card-title">
                <Trophy size={18} className="text-accent" />
                <span>Bảng Xếp Hạng Vòng Bảng</span>
              </div>
              <div style={{ fontSize: '12.5px' }}>
                {groupStageFinished ? (
                  <span className="badge badge-done">
                    ✅ Đã kết thúc vòng bảng - Top {qualifyCount} mỗi bảng giành vé vào {currentKnockoutFormat === 'quarter' ? 'Tứ Kết' : 'Bán Kết'}
                  </span>
                ) : (
                  <span className="badge badge-pending">
                    ⏳ Vòng bảng đang diễn ra - Vé đi tiếp sẽ được highlight khi xong vòng bảng
                  </span>
                )}
              </div>
            </div>

            {groupsData.map((g, idx) => {
              const groupMatches = matches.filter((m) => m.group === g.groupName && (m.status === 'Đã xong' || m.status === 'Đang LIVE'));
              const standings = calculateGroupStandings(g.teams || [], groupMatches);

              return (
                <div key={idx} className="mb24">
                  <h4 className="mb8" style={{ color: 'var(--accent-green)' }}>{g.groupName}</h4>
                  <div className="table-container">
                    <table className="dpl-table">
                      <thead>
                        <tr>
                          <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                          <th>Đội</th>
                          <th style={{ textAlign: 'center' }}>Trận</th>
                          <th style={{ textAlign: 'center' }}>T</th>
                          <th style={{ textAlign: 'center' }}>H</th>
                          <th style={{ textAlign: 'center' }}>B</th>
                          <th style={{ textAlign: 'center' }}>BT</th>
                          <th style={{ textAlign: 'center' }}>BB</th>
                          <th style={{ textAlign: 'center' }}>HS</th>
                          <th style={{ textAlign: 'center', fontWeight: 'bold' }}>Điểm</th>
                          {groupStageFinished && <th>Trạng Thái</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((t, index) => {
                          const isQualifying = groupStageFinished && index < qualifyCount;

                          return (
                            <tr key={t.name} className={isQualifying ? 'standings-row-qualify' : ''}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', color: isQualifying ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                                {index + 1}
                              </td>
                              <td style={{ fontWeight: '700' }}>{t.name}</td>
                              <td style={{ textAlign: 'center' }}>{t.p}</td>
                              <td style={{ textAlign: 'center' }}>{t.w}</td>
                              <td style={{ textAlign: 'center' }}>{t.d}</td>
                              <td style={{ textAlign: 'center' }}>{t.l}</td>
                              <td style={{ textAlign: 'center' }}>{t.gf}</td>
                              <td style={{ textAlign: 'center' }}>{t.ga}</td>
                              <td style={{ textAlign: 'center' }}>{t.gd}</td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-green)' }}>{t.pts}</td>
                              {groupStageFinished && (
                                <td>
                                  {isQualifying ? (
                                    <span className="badge badge-accent-glow" style={{ fontSize: '11px' }}>
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

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Trophy size={18} className="text-gold" />
                <span>Sơ Đồ Vòng Knock-out</span>
              </div>
            </div>
            <KnockoutBracket matches={matches} />
          </div>
        </section>
      )}
    </div>
  );
}