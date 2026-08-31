// server/routes/auth.js
import express from 'express';
import { generateToken, verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Danh sách tài khoản quản trị nội bộ
// Có thể mở rộng hoặc cấu hình qua biến môi trường
const USERS = [
  {
    id: 'u_btc',
    username: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASSWORD || 'btc2026',
    role: 'admin',
    name: 'Ban Tổ Chức Giải Đấu'
  },
  {
    id: 'u_thuky',
    username: process.env.REFEREE_USER || 'thuky',
    password: process.env.REFEREE_PASSWORD || 'thuky2026',
    role: 'referee',
    name: 'Tổ Thư Ký Bàn Trọng Tài'
  }
];

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu' });
  }

  const found = USERS.find((u) => u.username === username.trim() && u.password === password.trim());

  if (!found) {
    return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
  }

  const token = generateToken(found);

  return res.json({
    success: true,
    message: `Đăng nhập thành công với vai trò ${found.role === 'admin' ? 'Ban Tổ Chức' : 'Thư Ký Bàn'}`,
    token,
    user: {
      id: found.id,
      username: found.username,
      role: found.role,
      name: found.name
    }
  });
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

export default router;
