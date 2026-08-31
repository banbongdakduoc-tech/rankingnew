// src/App.jsx
import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from './services/firebase';
import PublicStandings from './pages/PublicStandings';
import RefereeDashboard from './pages/RefereeDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Navbar from './components/Navbar';
import { ToastProvider } from './components/Toast';
import { useToast } from './components/ToastContext';
import {
  loginUser,
  getSavedSession,
  clearSession
} from './services/authService';
import { LogIn, Lock, User, X, Shield } from 'lucide-react';
import './index.css';

// Modal Form Đăng Nhập
function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.warning('Vui lòng nhập tài khoản và mật khẩu!');
      return;
    }

    setIsLoading(true);
    const res = await loginUser(username, password);
    setIsLoading(false);

    if (res.success) {
      toast.success(`Đăng nhập thành công! Xin chào ${res.user.name || res.user.username}`);
      onLoginSuccess(res.user);
      onClose();
    } else {
      toast.error(res.message || 'Sai tài khoản hoặc mật khẩu!');
    }
  };

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        style={{ maxWidth: '420px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <Shield size={20} className="text-accent" />
            <h2 className="modal-title">Đăng Nhập Hệ Thống</h2>
          </div>
          <button type="button" className="btn ghost icon-only" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Tên tài khoản:</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input-dark"
                  placeholder="Nhập tên tài khoản..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ paddingLeft: '36px' }}
                  disabled={isLoading}
                  autoFocus
                />
                <User size={16} className="text-muted" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Mật khẩu:</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="input-dark"
                  placeholder="Nhập mật khẩu..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '36px' }}
                  disabled={isLoading}
                />
                <Lock size={16} className="text-muted" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn ghost" onClick={onClose} disabled={isLoading}>
              Hủy
            </button>
            <button type="submit" className="btn green" disabled={isLoading}>
              <LogIn size={16} /> {isLoading ? 'Đang kiểm tra...' : 'Đăng Nhập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// App Main Content
function MainApp() {
  const [currentUser, setCurrentUser] = useState(() => getSavedSession());
  const [currentRole, setCurrentRole] = useState(() => getSavedSession()?.role || 'public'); // 'public', 'referee', 'admin'
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Tournament Status & Config from Firebase
  const [tourStatus, setTourStatus] = useState('none');
  const [tourConfig, setTourConfig] = useState({ name: 'Dược Premier League 2026' });

  useEffect(() => {
    onValue(ref(db, 'tourStatus'), (snap) => setTourStatus(snap.val() || 'none'));
    onValue(ref(db, 'tourConfig'), (snap) => {
      if (snap.exists()) setTourConfig(snap.val());
    });
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setCurrentRole(user.role || 'public');
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setCurrentRole('public');
  };

  return (
    <div className="app-layout">
      {/* NAVBAR */}
      <Navbar
        currentRole={currentRole}
        currentUser={currentUser}
        tourStatus={tourStatus}
        tourConfig={tourConfig}
        onSelectRole={(role) => setCurrentRole(role)}
        onOpenLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
      />

      {/* LOGIN MODAL */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* MAIN VIEW BASED ON ROLE */}
      <main style={{ flex: 1 }}>
        {currentRole === 'public' && <PublicStandings />}
        {currentRole === 'referee' && <RefereeDashboard />}
        {currentRole === 'admin' && <AdminDashboard />}
      </main>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: '24px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
              {tourConfig.name || 'Dược Premier League 2026'}
            </span>
            <span>• CLB Thể Thao Trường Dược</span>
          </div>
          <div>
            Hệ thống Bảng Xếp Hạng & Quản Lý Giải Đấu Bóng Đá Trực Tuyến
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}