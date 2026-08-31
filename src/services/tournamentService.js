// src/services/tournamentService.js

/**
 * Tính toán bảng xếp hạng (Standings) cho một bảng đấu
 * @param {Array<string>} teams Danh sách tên các đội trong bảng
 * @param {Array<Object>} matches Danh sách các trận đấu đã hoàn thành của bảng
 * @returns {Array<Object>} Bảng xếp hạng đã sắp xếp
 */
export function calculateGroupStandings(teams = [], matches = []) {
  const standings = teams.map((teamName) => {
    let p = 0, w = 0, d = 0, l = 0, gf = 0, ga = 0;
    const form = []; // 'W', 'D', 'L' cho các trận gần nhất

    // Lọc các trận có đội này tham gia và đã có kết quả
    const teamMatches = matches
      .filter((m) => (m.status === 'Đã xong' || m.status === 'Đang LIVE') && (m.home === teamName || m.away === teamName))
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    teamMatches.forEach((m) => {
      p++;
      const isHome = m.home === teamName;
      const scored = Number(isHome ? m.scoreA : m.scoreB) || 0;
      const conceded = Number(isHome ? m.scoreB : m.scoreA) || 0;

      gf += scored;
      ga += conceded;

      if (scored > conceded) {
        w++;
        form.push('W');
      } else if (scored === conceded) {
        d++;
        form.push('D');
      } else {
        l++;
        form.push('L');
      }
    });

    const gd = gf - ga;
    const pts = w * 3 + d * 1;
    // Lấy 5 trận gần nhất
    const recentForm = form.slice(-5);

    return {
      name: teamName,
      p,
      w,
      d,
      l,
      gf,
      ga,
      gd,
      pts,
      form: recentForm
    };
  });

  // Sắp xếp: Điểm giảm dần -> Hiệu số bàn thắng bại -> Tổng bàn thắng -> Tên đội
  return standings.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name, 'vi');
  });
}

/**
 * Kiểm tra xem vòng bảng đã kết thúc 100% chưa
 * @param {Array<Object>} matches Danh sách trận đấu
 * @returns {boolean}
 */
export function isGroupStageFinished(matches = []) {
  const groupMatches = matches.filter((m) => m.group !== 'Vòng Knock-out');
  if (groupMatches.length === 0) return false;
  return groupMatches.every((m) => m.status === 'Đã xong');
}

/**
 * Lấy số lượng đội mỗi bảng sẽ giành vé vào vòng Knock-out
 * @param {string} knockoutFormat 'quarter' (Tứ kết) hoặc 'semi' (Bán kết)
 * @param {number} numGroups Số lượng bảng đấu
 * @returns {number} Số đội mỗi bảng lấy
 */
export function getQualifyingCount(knockoutFormat = 'quarter', numGroups = 2) {
  if (knockoutFormat === 'semi') {
    // Bán kết: Tổng 4 đội
    if (numGroups === 1) return 4;
    if (numGroups === 2) return 2; // Mỗi bảng lấy 2 đội đầu (Nhất A, Nhì A, Nhất B, Nhì B)
    return Math.max(1, Math.floor(4 / (numGroups || 1)));
  }
  // Mặc định Tứ kết: Tổng 8 đội
  if (numGroups === 1) return 8;
  if (numGroups === 2) return 4; // Mỗi bảng lấy 4 đội đầu (Nhất, Nhì, Ba, Tư A & B)
  if (numGroups === 4) return 2; // Mỗi bảng 2 đội đầu
  return Math.max(1, Math.floor(8 / (numGroups || 1)));
}

/**
 * Tính toán số bàn thắng của từng đội dựa trên danh sách sự kiện
 * @param {Array<Object>} events Danh sách sự kiện của trận đấu
 * @param {string} home Tên đội nhà
 * @param {string} away Tên đội khách
 * @returns {{ goalsA: number, goalsB: number }}
 */
export function calculateEventsGoals(events = [], home = '', away = '') {
  let goalsA = 0;
  let goalsB = 0;

  events.forEach((e) => {
    if (e.type === 'goal') {
      if (e.detail === 'own') {
        // Phản lưới nhà: Tính bàn thắng cho đội đối phương
        if (e.team === home) goalsB++;
        else if (e.team === away) goalsA++;
      } else {
        // Bàn thắng thường hoặc Penalty trong trận
        if (e.team === home) goalsA++;
        else if (e.team === away) goalsB++;
      }
    }
  });

  return { goalsA, goalsB };
}

/**
 * Chuyển đổi giây thành chuỗi phút thi đấu bóng đá chuẩn
 * Có xử lý phút bù giờ (+) theo thời lượng 1 hiệp
 * @param {number} totalSeconds Tổng số giây đã trôi qua
 * @param {number} halfDuration Thời lượng 1 hiệp (phút), mặc định 20
 * @param {number} currentPeriod Hiệp hiện tại (1 hoặc 2)
 * @returns {{ minuteNum: number, displayMinute: string }}
 */
export function formatMatchMinute(totalSeconds = 0, halfDuration = 20, currentPeriod = 1) {
  const safeHalf = halfDuration > 0 ? halfDuration : 20;
  const mins = Math.max(1, Math.ceil(totalSeconds / 60));

  if (currentPeriod === 1) {
    if (mins <= safeHalf) {
      return { minuteNum: mins, displayMinute: `${mins}'` };
    } else {
      const extra = mins - safeHalf;
      return { minuteNum: mins, displayMinute: `${safeHalf}+${extra}'` };
    }
  } else {
    const regularTotal = safeHalf * 2;
    if (mins <= regularTotal) {
      return { minuteNum: mins, displayMinute: `${mins}'` };
    } else {
      const extra = mins - regularTotal;
      return { minuteNum: mins, displayMinute: `${regularTotal}+${extra}'` };
    }
  }
}

/**
 * Format số giây thành chuỗi đồng hồ MM:SS
 */
export function formatSecondsToMMSS(totalSeconds = 0) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Tự động tạo các cặp đấu Knock-out hạt giống từ kết quả BXH vòng bảng
 * @param {Array<Object>} groupsData Dữ liệu các bảng
 * @param {Array<Object>} matches Danh sách trận đấu
 * @param {string} knockoutFormat 'quarter' hoặc 'semi'
 * @returns {Array<{ home: string, away: string, label: string }>}
 */
export function generateKnockoutPairs(groupsData = [], matches = [], knockoutFormat = 'quarter') {
  // Tính BXH cho từng bảng
  const groupStandings = groupsData.map((g) => {
    const gMatches = matches.filter((m) => m.group === g.groupName && m.status === 'Đã xong');
    return {
      groupName: g.groupName,
      standings: calculateGroupStandings(g.teams || [], gMatches)
    };
  });

  if (knockoutFormat === 'semi') {
    // BÁN KẾT (4 Đội)
    if (groupStandings.length >= 2) {
      const gA = groupStandings[0]?.standings || [];
      const gB = groupStandings[1]?.standings || [];

      return [
        {
          label: 'Bán Kết 1 (Nhất A vs Nhì B)',
          home: gA[0]?.name || 'Nhất Bảng A',
          away: gB[1]?.name || 'Nhì Bảng B'
        },
        {
          label: 'Bán Kết 2 (Nhất B vs Nhì A)',
          home: gB[0]?.name || 'Nhất Bảng B',
          away: gA[1]?.name || 'Nhì Bảng A'
        }
      ];
    } else {
      const all = groupStandings[0]?.standings || [];
      return [
        { label: 'Bán Kết 1 (Hạng 1 vs Hạng 4)', home: all[0]?.name || 'Hạng 1', away: all[3]?.name || 'Hạng 4' },
        { label: 'Bán Kết 2 (Hạng 2 vs Hạng 3)', home: all[1]?.name || 'Hạng 2', away: all[2]?.name || 'Hạng 3' }
      ];
    }
  }

  // TỨ KẾT (8 Đội)
  if (groupStandings.length >= 2) {
    const gA = groupStandings[0]?.standings || [];
    const gB = groupStandings[1]?.standings || [];

    return [
      {
        label: 'Tứ Kết 1 (Nhất A vs Tư B)',
        home: gA[0]?.name || 'Nhất Bảng A',
        away: gB[3]?.name || 'Tư Bảng B'
      },
      {
        label: 'Tứ Kết 2 (Nhì B vs Ba A)',
        home: gB[1]?.name || 'Nhì Bảng B',
        away: gA[2]?.name || 'Ba Bảng A'
      },
      {
        label: 'Tứ Kết 3 (Nhất B vs Tư A)',
        home: gB[0]?.name || 'Nhất Bảng B',
        away: gA[3]?.name || 'Tư Bảng A'
      },
      {
        label: 'Tứ Kết 4 (Nhì A vs Ba B)',
        home: gA[1]?.name || 'Nhì Bảng A',
        away: gB[2]?.name || 'Ba Bảng B'
      }
    ];
  } else {
    const all = groupStandings[0]?.standings || [];
    return [
      { label: 'Tứ Kết 1 (Hạng 1 vs Hạng 8)', home: all[0]?.name || 'Hạng 1', away: all[7]?.name || 'Hạng 8' },
      { label: 'Tứ Kết 2 (Hạng 4 vs Hạng 5)', home: all[3]?.name || 'Hạng 4', away: all[4]?.name || 'Hạng 5' },
      { label: 'Tứ Kết 3 (Hạng 2 vs Hạng 7)', home: all[1]?.name || 'Hạng 2', away: all[6]?.name || 'Hạng 7' },
      { label: 'Tứ Kết 4 (Hạng 3 vs Hạng 6)', home: all[2]?.name || 'Hạng 3', away: all[5]?.name || 'Hạng 6' }
    ];
  }
}

/**
 * Thống kê danh sách Vua phá lưới (Top Scorers)
 * @param {Array<Object>} matches Danh sách tất cả các trận đấu
 * @param {Object} playersData Dữ liệu cầu thủ theo đội { [teamName]: Array<Player> }
 * @returns {Array<Object>}
 */
export function getTopScorers(matches = [], playersData = {}) {
  const stats = {};

  matches.forEach((m) => {
    if (m.status !== 'Đã xong' && m.status !== 'Đang LIVE') return;

    (m.events || []).forEach((e) => {
      // Chỉ tính bàn thắng thường hoặc penalty trong trận, không tính phản lưới nhà
      if (e.type === 'goal' && e.detail !== 'own') {
        const key = `${e.team}@@${e.player}`;
        if (!stats[key]) {
          // Tìm avatar nếu có
          let avatar = '';
          const teamPlayers = playersData[e.team] || [];
          const found = teamPlayers.find(
            (p) => `${p.num} - ${p.name}` === e.player || p.name === e.player
          );
          if (found && found.avatar) avatar = found.avatar;

          stats[key] = {
            key,
            rawName: e.player,
            team: e.team,
            goals: 0,
            avatar
          };
        }
        stats[key].goals += 1;
      }
    });
  });

  return Object.values(stats)
    .sort((a, b) => b.goals - a.goals)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      displayName: cleanPlayerName(item.rawName)
    }));
}

/**
 * Thống kê danh sách thẻ phạt (Discipline / Fair-play)
 * @param {Array<Object>} matches Danh sách tất cả các trận đấu
 * @returns {Array<Object>}
 */
export function getDisciplineStats(matches = []) {
  const stats = {};

  matches.forEach((m) => {
    if (m.status !== 'Đã xong' && m.status !== 'Đang LIVE') return;

    (m.events || []).forEach((e) => {
      if (e.type === 'card') {
        const key = `${e.team}@@${e.player}`;
        if (!stats[key]) {
          stats[key] = {
            key,
            rawName: e.player,
            team: e.team,
            yellow: 0,
            red: 0
          };
        }
        if (e.detail === 'Vàng' || e.detail === 'yellow') stats[key].yellow += 1;
        if (e.detail === 'Đỏ' || e.detail === 'red') stats[key].red += 1;
      }
    });
  });

  return Object.values(stats)
    .sort((a, b) => {
      const scoreA = a.red * 3 + a.yellow * 1;
      const scoreB = b.red * 3 + b.yellow * 1;
      return scoreB - scoreA;
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      displayName: cleanPlayerName(item.rawName)
    }));
}

/**
 * Tự động phát hiện vi phạm thẻ phạt theo quy chuẩn giải đấu
 * Thẻ đỏ trực tiếp hoặc tích lũy 2 thẻ vàng trong cùng giai đoạn (Vòng bảng / Knock-out)
 * @param {Array<Object>} matches Danh sách các trận đấu
 * @param {Object} handledViolations Các vi phạm đã được Admin duyệt
 * @returns {Array<Object>}
 */
export function detectViolations(matches = [], handledViolations = {}) {
  const alerts = [];
  const playerStatsGroup = {};
  const playerStatsKO = {};

  const processMatches = (matchList, statsTracker, stageName) => {
    matchList
      .slice()
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
      .forEach((m) => {
        (m.events || []).forEach((e) => {
          if (e.type === 'card') {
            const pKey = `${e.team}@@${e.player}`;
            const vKey = `${pKey}@@${m.id}`;

            if (e.detail === 'Đỏ' || e.detail === 'red') {
              alerts.push({
                key: vKey,
                pKey,
                team: e.team,
                player: e.player,
                matchId: m.id,
                matchName: `${m.home} vs ${m.away}`,
                reason: `Thẻ Đỏ trực tiếp (${stageName})`
              });
              statsTracker[pKey] = { yellows: 0, lastMatchId: null };
            } else if (e.detail === 'Vàng' || e.detail === 'yellow') {
              if (!statsTracker[pKey]) statsTracker[pKey] = { yellows: 0, lastMatchId: null };
              if (statsTracker[pKey].lastMatchId !== m.id) {
                statsTracker[pKey].yellows += 1;
                statsTracker[pKey].lastMatchId = m.id;

                if (statsTracker[pKey].yellows >= 2) {
                  alerts.push({
                    key: vKey,
                    pKey,
                    team: e.team,
                    player: e.player,
                    matchId: m.id,
                    matchName: `${m.home} vs ${m.away}`,
                    reason: `Tích lũy 2 Thẻ Vàng (${stageName})`
                  });
                  statsTracker[pKey].yellows = 0;
                }
              }
            }
          }
        });
      });
  };

  const groupMatches = matches.filter(
    (m) => (m.status === 'Đã xong' || m.status === 'Chờ duyệt') && m.group !== 'Vòng Knock-out'
  );
  const koMatches = matches.filter(
    (m) => (m.status === 'Đã xong' || m.status === 'Chờ duyệt') && m.group === 'Vòng Knock-out'
  );

  processMatches(groupMatches, playerStatsGroup, 'Vòng Bảng');
  processMatches(koMatches, playerStatsKO, 'Knock-out');

  return alerts.filter((a) => !handledViolations[a.key]);
}

/**
 * Sinh lịch thi đấu vòng tròn 1 lượt (Round-Robin) cho các bảng
 * @param {Array<Object>} groupsData [{ groupName: 'Bảng A', teams: ['Đội 1', 'Đội 2', ...] }]
 * @returns {Object} Đối tượng matches lưu lên Firebase
 */
export function generateRoundRobinMatches(groupsData = []) {
  const matchesObj = {};

  groupsData.forEach((g) => {
    const teams = g.teams || [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        matchesObj[matchId] = {
          id: matchId,
          group: g.groupName,
          round: 'Vòng Bảng',
          home: teams[i],
          away: teams[j],
          date: '',
          ref: '',
          sec: '',
          status: 'Sắp diễn ra',
          scoreA: 0,
          scoreB: 0,
          penA: '',
          penB: '',
          rejectReason: '',
          secretaryNote: '',
          events: [],
          lineupA: [],
          lineupB: [],
          signatures: null
        };
      }
    }
  });

  return matchesObj;
}

/**
 * Định dạng hiển thị tên cầu thủ sạch đẹp (tách số áo nếu có dạng "10 - Tên Cầu Thủ")
 */
export function cleanPlayerName(raw = '') {
  if (!raw) return '';
  const match = raw.match(/^\d+\s*-\s*(.+)$/);
  return match ? match[1] : raw;
}

/**
 * Lấy số áo từ chuỗi tên "10 - Nguyễn Văn A"
 */
export function getPlayerNumber(raw = '') {
  if (!raw) return '';
  const match = raw.match(/^(\d+)\s*-\s*.+$/);
  return match ? match[1] : '';
}

/**
 * Format ngày giờ theo phong cách Việt Nam
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return 'Chưa xếp giờ';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}
