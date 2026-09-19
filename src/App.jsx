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
import { LogIn, Lock, User, Shield, FileText, ArrowLeft } from 'lucide-react';
import './index.css';

/**
 * Hook điều hướng URL path native mượt mà không reload trang (Tương thích 100% Netlify & Vite)
 */
function usePathRoute() {
  const getNormalized = () => {
    const raw = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    return raw;
  };

  const [currentPath, setCurrentPath] = useState(getNormalized);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(getNormalized());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to) => {
    const target = to.startsWith('/') ? to : `/${to}`;
    window.history.pushState({}, '', target);
    setCurrentPath(target.toLowerCase().replace(/\/+$/, '') || '/');
    window.scrollTo(0, 0);
  };

  return { currentPath, navigate };
}

/**
 * Giao diện Đăng Nhập Chuyên Dụng cho từng Cổng (/btc hoặc /thuky)
 */
function PortalLoginPage({ portalType = 'btc', onLoginSuccess, onNavigate }) {
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isBtc = portalType === 'btc';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.warning('Vui lòng nhập đầy đủ tài khoản và mật khẩu!');
      return;
    }

    setIsLoading(true);
    const res = await loginUser(username, password);
    setIsLoading(false);

    if (res.success) {
      // Kiểm tra quyền hạn tương ứng
      if (isBtc && res.user.role !== 'admin') {
        toast.warning('Tài khoản này là Thư Ký Bàn, không có quyền Ban Tổ Chức. Đang chuyển bạn sang Bàn Thư Ký...');
        onLoginSuccess(res.user);
        setTimeout(() => {
          onNavigate('/thuky');
        }, 1000);
        return;
      }

      toast.success(`Đăng nhập thành công! Xin chào ${res.user.name || res.user.username}`);
      onLoginSuccess(res.user);
    } else {
      toast.error(res.message || 'Sai tài khoản hoặc mật khẩu!');
    }
  };

  return (
    <div className="app-container" style={{ minHeight: '75vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div
        className="card animate-scale-up"
        style={{
          maxWidth: '460px',
          width: '100%',
          border: isBtc ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(56, 189, 248, 0.4)',
          boxShadow: isBtc ? '0 12px 40px rgba(245, 158, 11, 0.12)' : '0 12px 40px rgba(56, 189, 248, 0.12)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <div className="card-header text-center" style={{ flexDirection: 'column', gap: '8px', paddingBottom: '8px' }}>
          <div style={{ display: 'inline-flex', padding: '14px', borderRadius: '50%', background: isBtc ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)', margin: '0 auto 6px' }}>
            {isBtc ? <Shield size={36} className="text-gold" /> : <FileText size={36} style={{ color: '#38bdf8' }} />}
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>
            {isBtc ? 'CỔNG BAN TỔ CHỨC' : 'CỔNG THƯ KÝ BÀN'}
          </h2>
          <p className="text-dim" style={{ fontSize: '13px', margin: 0 }}>
            {isBtc ? 'Khu vực quản trị và điều hành giải đấu bóng đá' : 'Khu vực lập biên bản, bấm giờ & ghi nhận tại sân'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px' }}>
            <div className="form-group mb16">
              <label className="form-label">Tên tài khoản:</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input-dark"
                  placeholder="Nhập tên đăng nhập..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ paddingLeft: '38px', height: '42px' }}
                  disabled={isLoading}
                  autoFocus
                />
                <User size={16} className="text-muted" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <div className="form-group mb20">
              <label className="form-label">Mật khẩu:</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="input-dark"
                  placeholder="Nhập mật khẩu..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '38px', height: '42px' }}
                  disabled={isLoading}
                />
                <Lock size={16} className="text-muted" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <button
              type="submit"
              className={`btn ${isBtc ? 'green' : 'green'} block`}
              style={{ padding: '12px', fontSize: '15px', fontWeight: '800' }}
              disabled={isLoading}
            >
              <LogIn size={17} />
              <span>{isLoading ? 'Đang kiểm tra thông tin...' : isBtc ? 'ĐĂNG NHẬP BAN TỔ CHỨC' : 'ĐĂNG NHẬP THƯ KÝ BÀN'}</span>
            </button>
          </div>

          {/* Footnotes & Navigation switch */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 24px', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => onNavigate('/')}
              style={{ justifyContent: 'center', color: 'var(--text-secondary)' }}
            >
              <ArrowLeft size={14} />
              <span>Quay lại trang xem giải đấu công khai</span>
            </button>

            {isBtc ? (
              <div className="text-center text-dim" style={{ fontSize: '12px', marginTop: '4px' }}>
                Bạn là Thư Ký Bàn?{' '}
                <a
                  href="/thuky"
                  onClick={(e) => { e.preventDefault(); onNavigate('/thuky'); }}
                  style={{ color: '#38bdf8', fontWeight: 'bold' }}
                >
                  Đăng nhập tại Cổng Thư Ký ➔
                </a>
              </div>
            ) : (
              <div className="text-center text-dim" style={{ fontSize: '12px', marginTop: '4px' }}>
                Bạn thuộc Ban Tổ Chức?{' '}
                <a
                  href="/btc"
                  onClick={(e) => { e.preventDefault(); onNavigate('/btc'); }}
                  style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}
                >
                  Đăng nhập tại Cổng BTC ➔
                </a>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// App Main Content
function MainApp() {
  const { currentPath, navigate } = usePathRoute();
  const [currentUser, setCurrentUser] = useState(() => getSavedSession());

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
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
  };

  const isBtcRoute = currentPath === '/btc' || currentPath === '/admin';
  const isRefereeRoute = currentPath === '/thuky' || currentPath === '/referee';

  return (
    <div className="app-layout">
      {/* NAVBAR */}
      <Navbar
        currentPath={currentPath}
        currentUser={currentUser}
        tourStatus={tourStatus}
        tourConfig={tourConfig}
        onNavigate={navigate}
        onLogout={handleLogout}
      />

      {/* MAIN VIEW BASED ON ROUTE PATH */}
      <main style={{ flex: 1 }}>
        {/* 1. CỔNG BAN TỔ CHỨC (/btc hoặc /admin) */}
        {isBtcRoute && (
          currentUser?.role === 'admin' ? (
            <AdminDashboard />
          ) : (
            <PortalLoginPage
              portalType="btc"
              onLoginSuccess={handleLoginSuccess}
              onNavigate={navigate}
            />
          )
        )}

        {/* 2. CỔNG THƯ KÝ BÀN (/thuky hoặc /referee) */}
        {isRefereeRoute && (
          (currentUser?.role === 'referee' || currentUser?.role === 'admin') ? (
            <RefereeDashboard />
          ) : (
            <PortalLoginPage
              portalType="thuky"
              onLoginSuccess={handleLoginSuccess}
              onNavigate={navigate}
            />
          )
        )}

        {/* 3. TRANG CÔNG KHAI CHO KHÁN GIẢ (Default: /) */}
        {!isBtcRoute && !isRefereeRoute && (
          <PublicStandings />
        )}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>Hệ thống Bảng Xếp Hạng & Quản Lý Giải Đấu Bóng Đá Trực Tuyến</span>
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