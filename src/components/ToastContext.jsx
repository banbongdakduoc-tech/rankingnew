// src/components/ToastContext.jsx
import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      success: (msg) => console.log('SUCCESS:', msg),
      error: (msg) => console.error('ERROR:', msg),
      warning: (msg) => console.warn('WARN:', msg),
      info: (msg) => console.info('INFO:', msg)
    };
  }
  return context;
};
