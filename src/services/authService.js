// src/services/authService.js
import { ref, get } from 'firebase/database';
import { db } from './firebase';

const LOCAL_STORAGE_KEY = 'dpl_auth_session';

/**
 * Đăng nhập hệ thống (Xác thực trực tiếp với cơ sở dữ liệu Firebase Realtime)
 * @param {string} username Tên tài khoản
 * @param {string} password Mật khẩu
 * @returns {Promise<{ success: boolean, role?: string, user?: Object, message?: string }>}
 */
export async function loginUser(username, password) {
  const cleanUser = username?.trim().toLowerCase();
  const cleanPass = password?.trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, message: 'Vui lòng nhập đầy đủ tài khoản và mật khẩu!' };
  }

  try {
    // Kiểm tra tài khoản trên Firebase Realtime Database
    const snapshot = await get(ref(db, `accounts/${cleanUser}`));
    if (snapshot.exists()) {
      const acc = snapshot.val();
      if (acc.password === cleanPass) {
        const sessionData = {
          username: cleanUser,
          role: acc.role || 'referee',
          name: acc.name || cleanUser
        };
        saveSession(sessionData);
        return { success: true, role: sessionData.role, user: sessionData };
      } else {
        return { success: false, message: 'Mật khẩu không chính xác!' };
      }
    }

    return { success: false, message: 'Tài khoản không tồn tại trên hệ thống dữ liệu!' };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Không thể kết nối đến máy chủ xác thực dữ liệu!' };
  }
}

/**
 * Lưu phiên đăng nhập
 */
export function saveSession(sessionData) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessionData));
  } catch (e) {
    console.error('Error saving session:', e);
  }
}

/**
 * Lấy phiên đăng nhập hiện tại
 */
export function getSavedSession() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Đăng xuất
 */
export function clearSession() {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing session:', e);
  }
}
