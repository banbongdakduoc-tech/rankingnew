// server/routes/tournament.js
import express from 'express';
import { db } from '../config/db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/tournament/data (Public - Khởi tạo toàn bộ dữ liệu frontend)
router.get('/data', (req, res) => {
  const data = db.getAll();
  return res.json({
    success: true,
    data
  });
});

// POST /api/tournament/status (Admin)
router.post('/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, message: 'Thiếu trường status' });
  }

  db.set('tourStatus', status);
  req.app.get('io')?.emit('tourStatus_updated', status);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, status, message: `Đã cập nhật trạng thái giải đấu: ${status}` });
});

// POST /api/tournament/config (Admin)
router.post('/config', requireAdmin, (req, res) => {
  const { config } = req.body;
  if (!config) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin config' });
  }

  const current = db.get('tourConfig') || {};
  const updated = { ...current, ...config };
  db.set('tourConfig', updated);

  req.app.get('io')?.emit('tourConfig_updated', updated);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, config: updated, message: 'Đã cập nhật cấu hình giải đấu' });
});

// POST /api/tournament/groups (Admin)
router.post('/groups', requireAdmin, (req, res) => {
  const { groupsData } = req.body;
  if (!Array.isArray(groupsData)) {
    return res.status(400).json({ success: false, message: 'groupsData phải là một mảng' });
  }

  db.set('groupsData', groupsData);
  req.app.get('io')?.emit('groupsData_updated', groupsData);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, groupsData, message: 'Đã lưu danh sách bảng đấu' });
});

// POST /api/tournament/generate-schedule (Admin)
router.post('/generate-schedule', requireAdmin, (req, res) => {
  const groupsData = db.get('groupsData') || [];
  const matches = {};

  groupsData.forEach((group, gIdx) => {
    const teams = group.teams || [];
    const n = teams.length;
    if (n < 2) return;

    let roundNum = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const matchId = `match_${gIdx}_${roundNum}_${i}_${j}_${Date.now()}`;
        matches[matchId] = {
          id: matchId,
          group: group.groupName,
          round: `Vòng ${roundNum}`,
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
          events: [],
          advancingTeam: ''
        };
        roundNum++;
      }
    }
  });

  db.set('matches', matches);
  db.set('tourStatus', 'draft');

  req.app.get('io')?.emit('matches_updated', matches);
  req.app.get('io')?.emit('tourStatus_updated', 'draft');
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({
    success: true,
    matches,
    message: `Đã tự động sinh ${Object.keys(matches).length} trận đấu vòng bảng!`
  });
});

// POST /api/tournament/knockout (Admin - Khởi tạo hoặc nối tiếp vòng Knock-out)
router.post('/knockout', requireAdmin, (req, res) => {
  const { matchesList } = req.body;
  if (!Array.isArray(matchesList) || matchesList.length === 0) {
    return res.status(400).json({ success: false, message: 'Danh sách trận knock-out không hợp lệ' });
  }

  const currentMatches = db.get('matches') || {};
  const updates = { ...currentMatches };

  matchesList.forEach((m, idx) => {
    const matchId = m.id || `match_ko_${Date.now()}_${idx}`;
    updates[matchId] = {
      id: matchId,
      group: 'Vòng Knock-out',
      round: m.round || 'Knock-out',
      home: m.home,
      away: m.away,
      date: m.date || '',
      ref: m.ref || '',
      sec: m.sec || '',
      status: m.status || 'Sắp diễn ra',
      scoreA: m.scoreA ?? 0,
      scoreB: m.scoreB ?? 0,
      penA: m.penA ?? '',
      penB: m.penB ?? '',
      events: m.events || [],
      advancingTeam: m.advancingTeam || ''
    };
  });

  db.set('matches', updates);
  req.app.get('io')?.emit('matches_updated', updates);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, message: `Đã cập nhật ${matchesList.length} trận đấu Knock-out thành công!` });
});

// POST /api/tournament/reset-knockout (Admin)
router.post('/reset-knockout', requireAdmin, (req, res) => {
  const currentMatches = db.get('matches') || {};
  const filtered = {};

  Object.entries(currentMatches).forEach(([id, m]) => {
    if (m.group !== 'Vòng Knock-out') {
      filtered[id] = m;
    }
  });

  db.set('matches', filtered);
  req.app.get('io')?.emit('matches_updated', filtered);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, message: 'Đã xóa toàn bộ các trận Knock-out để thiết lập lại từ đầu' });
});

// DELETE /api/tournament/reset (Admin - Reset sạch dữ liệu)
router.delete('/reset', requireAdmin, (req, res) => {
  const resetData = db.reset();
  req.app.get('io')?.emit('db_changed', resetData);
  return res.json({ success: true, message: 'Đã reset toàn bộ giải đấu về mặc định' });
});

export default router;
