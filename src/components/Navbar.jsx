// src/components/Navbar.jsx
import {
  Trophy,
  Shield,
  FileText,
  Settings,
  LogIn,
  LogOut,
  Radio,
  User,
  Clock
} from 'lucide-react';

export default function Navbar({
  currentRole = 'public',
  currentUser = null,
  tourStatus = 'none',
  tourConfig = {},
  onSelectRole,
  onOpenLogin,
  onLogout
}) {
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
        <div className="navbar-brand" onClick={() => onSelectRole('public')}>
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
              {getStatusBadge()}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="navbar-nav">
          <button
            className={`nav-link ${currentRole === 'public' ? 'active' : ''}`}
            onClick={() => onSelectRole('public')}
          >
            <Radio size={16} className={currentRole === 'public' ? 'text-accent' : ''} />
            <span>Khán Giả</span>
          </button>

          {currentUser && (currentUser.role === 'referee' || currentUser.role === 'admin') && (
            <button
              className={`nav-link ${currentRole === 'referee' ? 'active' : ''}`}
              onClick={() => onSelectRole('referee')}
            >
              <FileText size={16} className={currentRole === 'referee' ? 'text-accent' : ''} />
              <span>Thư Ký Bàn</span>
            </button>
          )}

          {currentUser && currentUser.role === 'admin' && (
            <button
              className={`nav-link ${currentRole === 'admin' ? 'active' : ''}`}
              onClick={() => onSelectRole('admin')}
            >
              <Settings size={16} className={currentRole === 'admin' ? 'text-accent' : ''} />
              <span>Ban Tổ Chức</span>
            </button>
          )}
        </nav>

        {/* User Account Controls */}
        <div className="navbar-actions">
          {currentUser ? (
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
                title="Đăng xuất khỏi hệ thống"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button className="btn btn-login-nav" onClick={onOpenLogin}>
              <LogIn size={16} />
              <span>Đăng Nhập</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
