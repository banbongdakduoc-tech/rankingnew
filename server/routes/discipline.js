// server/routes/discipline.js
import express from 'express';
import { db } from '../config/db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/discipline/suspensions (Public)
router.get('/suspensions', (req, res) => {
  const suspensions = db.get('suspensions') || {};
  return res.json({ success: true, suspensions });
});

// POST /api/discipline/ban (Admin - Treo giò)
router.post('/ban', requireAdmin, (req, res) => {
  const { pKey, reason, matchId, vKey } = req.body;

  if (!pKey || !reason) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin cầu thủ hoặc lý do kỷ luật' });
  }

  const suspensions = db.get('suspensions') || {};
  suspensions[pKey] = {
    reason,
    matchId: matchId || '',
    createdAt: new Date().toISOString()
  };
  db.set('suspensions', suspensions);

  if (vKey) {
    const handled = db.get('handledViolations') || {};
    handled[vKey] = true;
    db.set('handledViolations', handled);
  }

  req.app.get('io')?.emit('suspensions_updated', suspensions);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, message: `Đã áp dụng án phạt treo giò với cầu thủ`, suspensions });
});

// DELETE /api/discipline/ban/:pKey (Admin - Gỡ án phạt)
router.delete('/ban/:pKey', requireAdmin, (req, res) => {
  const { pKey } = req.params;
  const suspensions = db.get('suspensions') || {};

  delete suspensions[pKey];
  db.set('suspensions', suspensions);

  req.app.get('io')?.emit('suspensions_updated', suspensions);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, message: 'Đã gỡ án phạt treo giò cho cầu thủ', suspensions });
});

// POST /api/discipline/pardon (Admin - Ân xá)
router.post('/pardon', requireAdmin, (req, res) => {
  const { vKey } = req.body;
  if (!vKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cảnh báo vKey' });
  }

  const handled = db.get('handledViolations') || {};
  handled[vKey] = true;
  db.set('handledViolations', handled);

  req.app.get('io')?.emit('handledViolations_updated', handled);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, message: 'Đã ân xá cảnh báo' });
});

export default router;
