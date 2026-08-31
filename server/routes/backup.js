// server/routes/backup.js
import express from 'express';
import { db } from '../config/db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/backup/export (Admin - Tải file sao lưu)
router.get('/export', requireAdmin, (req, res) => {
  const data = db.getAll();
  const filename = `dpl_backup_${new Date().toISOString().slice(0, 10)}.json`;

  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.setHeader('Content-Type', 'application/json');
  return res.send(JSON.stringify(data, null, 2));
});

// POST /api/backup/import (Admin - Khôi phục từ dữ liệu JSON)
router.post('/import', requireAdmin, (req, res) => {
  const { backupData } = req.body;
  if (!backupData || typeof backupData !== 'object') {
    return res.status(400).json({ success: false, message: 'Dữ liệu file sao lưu không hợp lệ' });
  }

  const restored = db.importData(backupData);
  req.app.get('io')?.emit('db_changed', restored);

  return res.json({
    success: true,
    message: '🎉 Đã khôi phục toàn bộ dữ liệu giải đấu từ bản sao lưu thành công!'
  });
});

export default router;
