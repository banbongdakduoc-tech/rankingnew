// src/components/Navbar.jsx
import {
  Trophy,
  Shield,
  FileText,
  Settings,
  LogOut,
  Radio,
  User,
  Clock,
  Eye
} from 'lucide-react';

export default function Navbar({
  currentPath = '/',
  currentUser = null,
  tourStatus = 'none',
  tourConfig = {},
  onNavigate,
  onLogout
}) {
  const isBtcPortal = currentPath === '/btc' || currentPath === '/admin';
  const isRefereePortal = currentPath === '/thuky' || currentPath === '/referee';
  const isPublic = !isBtcPortal && !isRefereePortal;

  const getStatusBadge = () => {
    switch (tourStatus) {
      case 'active':
        return (
          <div className="status-pill active">
            <span className="live-dot pulse"></span>
            <span>MÙA GIẢI ĐANG DIỄN RA</span>
          </div>
        );
      case 'completed':
        return (
          <div className="status-pill completed">
            <Trophy size={14} className="text-gold" />
            <span>MÙA GIẢI ĐÃ KHÉP LẠI</span>
          </div>
        );
      case 'draft':
      case 'setup_teams':
      case 'config':
        return (
          <div className="status-pill preparing">
            <Clock size={14} />
            <span>ĐANG CHUẨN BỊ LỊCH ĐẤU</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <header className="app-navbar">
      <div className="navbar-container">
        {/* Brand & Tournament Name */}
        <div className="navbar-brand" onClick={() => onNavigate('/')} style={{ cursor: 'pointer' }}>
          <div className="brand-logo-wrap">
            <img
              src="/logo.png"
              alt="CLB Thể Thao Trường Dược"
              className="brand-logo"
            />
          </div>
          <div className="brand-info">
            <h1 className="brand-title">
              {tourConfig.name || 'Dược Premier League 2026'}
            </h1>
            <div className="brand-subtitle">
              <span>CLB Thể Thao Trường Dược</span>
              {isPublic && getStatusBadge()}
              {isBtcPortal && (
                <span className="badge badge-accent-glow" style={{ marginLeft: '6px', fontSize: '11px' }}>
                  🛡️ CỔNG BAN TỔ CHỨC
                </span>
              )}
              {isRefereePortal && (
                <span className="badge badge-live" style={{ marginLeft: '6px', fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}>
                  📝 BÀN THƯ KÝ TRỌNG TÀI
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="navbar-nav">
          {isPublic && (
            <button className="nav-link active">
              <Radio size={16} className="text-accent" />
              <span>Bảng Xếp Hạng & Lịch Đấu</span>
            </button>
          )}

          {isBtcPortal && (
            <>
              <button className="nav-link active">
                <Settings size={16} className="text-accent" />
                <span>Điều Hành & Duyệt Biên Bản</span>
              </button>
              {currentUser?.role === 'admin' && (
                <button
                  className="nav-link"
                  onClick={() => onNavigate('/thuky')}
                  title="Chuyển sang giao diện Bàn Thư Ký"
                >
                  <FileText size={16} />
                  <span>Sang Bàn Thư Ký</span>
                </button>
              )}
            </>
          )}

          {isRefereePortal && (
            <>
              <button className="nav-link active">
                <FileText size={16} className="text-accent" />
                <span>Lập Biên Bản & Bấm Giờ</span>
              </button>
              {currentUser?.role === 'admin' && (
                <button
                  className="nav-link"
                  onClick={() => onNavigate('/btc')}
                  title="Quay lại Cổng Ban Tổ Chức"
                >
                  <Settings size={16} />
                  <span>Về Cổng BTC</span>
                </button>
              )}
            </>
          )}
        </nav>

        {/* Action Controls */}
        <div className="navbar-actions">
          {/* Nút xem trang khán giả khi đang ở trong cổng quản trị */}
          {(isBtcPortal || isRefereePortal) && (
            <button
              type="button"
              className="btn ghost small mr8"
              onClick={() => onNavigate('/')}
              title="Mở giao diện xem giải đấu công khai"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Eye size={14} />
              <span>Xem Trang Khán Giả</span>
            </button>
          )}

          {/* Đang ở trang công khai nhưng đã đăng nhập tài khoản trước đó */}
          {isPublic && currentUser && (
            <button
              type="button"
              className="btn ghost small mr8"
              onClick={() => onNavigate(currentUser.role === 'admin' ? '/btc' : '/thuky')}
              style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {currentUser.role === 'admin' ? <Shield size={14} /> : <FileText size={14} />}
              <span>Vào Cổng {currentUser.role === 'admin' ? 'BTC' : 'Thư Ký'}</span>
            </button>
          )}

          {/* User Profile & Logout (cho cổng BTC và Thư Ký) */}
          {currentUser && (isBtcPortal || isRefereePortal) && (
            <div className="user-profile-badge">
              <div className="user-avatar">
                {currentUser.role === 'admin' ? (
                  <Shield size={16} className="text-gold" />
                ) : (
                  <User size={16} className="text-accent" />
                )}
              </div>
              <div className="user-meta">
                <span className="user-name">{currentUser.name || currentUser.username}</span>
                <span className="user-role-label">
                  {currentUser.role === 'admin' ? 'Ban Tổ Chức' : 'Tổ Thư Ký'}
                </span>
              </div>
              <button
                className="btn-icon-logout"
                onClick={onLogout}
                title="Đăng xuất khỏi tài khoản"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
