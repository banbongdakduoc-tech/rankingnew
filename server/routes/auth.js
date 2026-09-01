import express from 'express';
import { db } from '../config/db.js';
import { generateToken, verifyToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu' });
  }

  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  // Kiểm tra tài khoản từ cơ sở dữ liệu
  const accounts = db.get('accounts') || {};
  const found = accounts[cleanUser];

  if (!found || found.password !== cleanPass) {
    return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
  }

  const userObj = {
    id: cleanUser,
    username: cleanUser,
    role: found.role || 'referee',
    name: found.name || cleanUser
  };

  const token = generateToken(userObj);

  return res.json({
    success: true,
    message: `Đăng nhập thành công với vai trò ${userObj.role === 'admin' ? 'Ban Tổ Chức' : 'Thư Ký Bàn'}`,
    token,
    user: userObj
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
