// server/middleware/auth.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dpl_2026_super_secret_jwt_key_secure_xyz';

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để truy cập tài nguyên này' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

export function requireAdmin(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Quyền hạn bị từ chối: Chỉ Ban Tổ Chức mới được thực hiện thao tác này' });
    }
    next();
  });
}

export function requireStaff(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'referee') {
      return res.status(403).json({ success: false, message: 'Quyền hạn bị từ chối: Yêu cầu quyền Ban Tổ Chức hoặc Thư Ký Bàn' });
    }
    next();
  });
}
