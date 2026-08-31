// server/routes/players.js
import express from 'express';
import { db } from '../config/db.js';
import { requireAdmin, requireStaff } from '../middleware/auth.js';

const router = express.Router();

// GET /api/players (Public)
router.get('/', (req, res) => {
  const players = db.get('players') || {};
  return res.json({ success: true, players });
});

// GET /api/players/:team (Public)
router.get('/:team', (req, res) => {
  const players = db.get('players') || {};
  const teamPlayers = players[req.params.team] || [];
  return res.json({ success: true, team: req.params.team, players: teamPlayers });
});

// POST /api/players/:team (Admin - Ghi đè danh sách cầu thủ của 1 đội)
router.post('/:team', requireAdmin, (req, res) => {
  const { team } = req.params;
  const { playersList } = req.body;

  if (!Array.isArray(playersList)) {
    return res.status(400).json({ success: false, message: 'Dữ liệu cầu thủ phải là mảng Array' });
  }

  const allPlayers = db.get('players') || {};
  allPlayers[team] = playersList;
  db.set('players', allPlayers);

  req.app.get('io')?.emit('players_updated', allPlayers);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({
    success: true,
    message: `Đã lưu danh sách ${playersList.length} cầu thủ cho đội [${team}] thành công!`,
    players: playersList
  });
});

// POST /api/players/:team/add (Staff / Admin - Thêm 1 cầu thủ)
router.post('/:team/add', requireStaff, (req, res) => {
  const { team } = req.params;
  const { num, name, shirtName, avatar } = req.body;

  if (!num || !name) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập số áo và tên cầu thủ' });
  }

  const allPlayers = db.get('players') || {};
  const currentList = allPlayers[team] || [];

  const newP = {
    team,
    num: Number(num),
    name: name.trim(),
    shirtName: shirtName ? shirtName.trim() : name.trim(),
    avatar: avatar || ''
  };

  const updatedList = [...currentList, newP];
  allPlayers[team] = updatedList;
  db.set('players', allPlayers);

  req.app.get('io')?.emit('players_updated', allPlayers);
  req.app.get('io')?.emit('db_changed', db.getAll());

  return res.json({ success: true, message: `Đã thêm cầu thủ #${newP.num} ${newP.name}`, player: newP });
});

export default router;
