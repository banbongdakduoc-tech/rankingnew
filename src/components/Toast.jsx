// src/components/Toast.jsx
import { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { ToastContext } from './ToastContext';

let toastCounter = 1;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info', duration = 3500) => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toast = {
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    warning: (msg, duration) => addToast(msg, 'warning', duration),
    info: (msg, duration) => addToast(msg, 'info', duration)
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => {
          let icon = <Info size={20} className="toast-icon info" />;
          if (t.type === 'success') icon = <CheckCircle2 size={20} className="toast-icon success" />;
          if (t.type === 'error') icon = <XCircle size={20} className="toast-icon error" />;
          if (t.type === 'warning') icon = <AlertTriangle size={20} className="toast-icon warning" />;

          return (
            <div key={t.id} className={`toast-item toast-${t.type} animate-slide-in`}>
              <div className="toast-content">
                {icon}
                <div className="toast-message">{t.message}</div>
              </div>
              <button
                type="button"
                className="toast-close"
                onClick={() => removeToast(t.id)}
                aria-label="Close notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
