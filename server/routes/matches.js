// server/routes/matches.js
import express from 'express';
import { db } from '../config/db.js';
import { requireStaff, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/matches (Public)
router.get('/', (req, res) => {
  const matches = db.get('matches') || {};
  return res.json({ success: true, matches });
});

// GET /api/matches/:id (Public)
router.get('/:id', (req, res) => {
  const matches = db.get('matches') || {};
  const match = matches[req.params.id];
  if (!match) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy trận đấu' });
  }
  return res.json({ success: true, match });
});

// PUT /api/matches/:id (Staff - Update match info / status / timer)
router.put('/:id', requireStaff, (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const matches = db.get('matches') || {};
  if (!matches[id]) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy trận đấu' });
  }

  const updatedMatch = { ...matches[id], ...updates };
  matches[id] = updatedMatch;
  db.set('matches', matches);

  req.app.get('io')?.emit('match_updated', updatedMatch);
  req.app.get('io')?.emit('matches_updated', matches);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, match: updatedMatch });
});

// POST /api/matches/:id/events (Staff - Thêm sự kiện bàn thắng / thẻ phạt realtime)
router.post('/:id/events', requireStaff, (req, res) => {
  const { id } = req.params;
  const newEvent = req.body;

  if (!newEvent || !newEvent.player || !newEvent.type) {
    return res.status(400).json({ success: false, message: 'Dữ liệu sự kiện không hợp lệ' });
  }

  const matches = db.get('matches') || {};
  const match = matches[id];
  if (!match) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy trận đấu' });
  }

  const eventItem = {
    id: newEvent.id || Date.now(),
    type: newEvent.type, // 'goal' | 'card'
    detail: newEvent.detail || 'normal',
    player: newEvent.player,
    team: newEvent.team,
    minute: Number(newEvent.minute) || 1,
    displayMinute: newEvent.displayMinute || `${newEvent.minute}'`
  };

  const events = [...(match.events || []), eventItem].sort((a, b) => a.minute - b.minute);

  // Tự động tính lại tỉ số từ bàn thắng
  let goalsA = 0;
  let goalsB = 0;
  events.forEach((e) => {
    if (e.type === 'goal') {
      if (e.detail === 'own') {
        if (e.team === match.home) goalsB += 1;
        else if (e.team === match.away) goalsA += 1;
      } else {
        if (e.team === match.home) goalsA += 1;
        else if (e.team === match.away) goalsB += 1;
      }
    }
  });

  const updatedMatch = {
    ...match,
    events,
    scoreA: goalsA,
    scoreB: goalsB
  };

  matches[id] = updatedMatch;
  db.set('matches', matches);

  // Phát sóng realtime
  req.app.get('io')?.emit('match_updated', updatedMatch);
  req.app.get('io')?.emit('matches_updated', matches);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, match: updatedMatch, newEvent: eventItem });
});

// DELETE /api/matches/:id/events/:eventId (Staff - Xóa sự kiện)
router.delete('/:id/events/:eventId', requireStaff, (req, res) => {
  const { id, eventId } = req.params;
  const matches = db.get('matches') || {};
  const match = matches[id];
  if (!match) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy trận đấu' });
  }

  const events = (match.events || []).filter((e) => String(e.id) !== String(eventId));

  let goalsA = 0;
  let goalsB = 0;
  events.forEach((e) => {
    if (e.type === 'goal') {
      if (e.detail === 'own') {
        if (e.team === match.home) goalsB += 1;
        else if (e.team === match.away) goalsA += 1;
      } else {
        if (e.team === match.home) goalsA += 1;
        else if (e.team === match.away) goalsB += 1;
      }
    }
  });

  const updatedMatch = {
    ...match,
    events,
    scoreA: goalsA,
    scoreB: goalsB
  };

  matches[id] = updatedMatch;
  db.set('matches', matches);

  req.app.get('io')?.emit('match_updated', updatedMatch);
  req.app.get('io')?.emit('matches_updated', matches);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, match: updatedMatch });
});

// POST /api/matches/:id/submit (Staff - Thư ký nộp biên bản & chữ ký lên BTC)
router.post('/:id/submit', requireStaff, (req, res) => {
  const { id } = req.params;
  const { signatures, secretaryNote, lineupA, lineupB, penA, penB } = req.body;

  const matches = db.get('matches') || {};
  const match = matches[id];
  if (!match) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy trận đấu' });
  }

  const updatedMatch = {
    ...match,
    status: 'Chờ duyệt',
    signatures: signatures || match.signatures || null,
    secretaryNote: secretaryNote !== undefined ? secretaryNote : (match.secretaryNote || ''),
    lineupA: lineupA || match.lineupA || [],
    lineupB: lineupB || match.lineupB || [],
    penA: penA !== undefined ? penA : (match.penA || ''),
    penB: penB !== undefined ? penB : (match.penB || '')
  };

  matches[id] = updatedMatch;
  db.set('matches', matches);

  req.app.get('io')?.emit('match_updated', updatedMatch);
  req.app.get('io')?.emit('matches_updated', matches);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, message: 'Đã nộp biên bản thành công lên Ban Tổ Chức!', match: updatedMatch });
});

// POST /api/matches/:id/approve (Admin - BTC duyệt biên bản)
router.post('/:id/approve', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { scoreA, scoreB, penA, penB, events, advancingTeam } = req.body;

  const matches = db.get('matches') || {};
  const match = matches[id];
  if (!match) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy trận đấu' });
  }

  const updatedMatch = {
    ...match,
    status: 'Đã xong',
    scoreA: scoreA !== undefined ? Number(scoreA) : match.scoreA,
    scoreB: scoreB !== undefined ? Number(scoreB) : match.scoreB,
    penA: penA !== undefined ? penA : (match.penA || ''),
    penB: penB !== undefined ? penB : (match.penB || ''),
    events: events || match.events || [],
    advancingTeam: advancingTeam !== undefined ? advancingTeam : (match.advancingTeam || ''),
    rejectReason: ''
  };

  matches[id] = updatedMatch;
  db.set('matches', matches);

  req.app.get('io')?.emit('match_updated', updatedMatch);
  req.app.get('io')?.emit('matches_updated', matches);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, message: 'Đã phê duyệt kết quả trận đấu!', match: updatedMatch });
});

// POST /api/matches/:id/reject (Admin - BTC từ chối biên bản)
router.post('/:id/reject', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const matches = db.get('matches') || {};
  const match = matches[id];
  if (!match) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy trận đấu' });
  }

  const updatedMatch = {
    ...match,
    status: 'Bị từ chối',
    rejectReason: reason || 'Ban Tổ Chức yêu cầu kiểm tra lại biên bản'
  };

  matches[id] = updatedMatch;
  db.set('matches', matches);

  req.app.get('io')?.emit('match_updated', updatedMatch);
  req.app.get('io')?.emit('matches_updated', matches);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, message: 'Đã trả biên bản về cho Thư ký sửa đổi', match: updatedMatch });
});

export default router;
