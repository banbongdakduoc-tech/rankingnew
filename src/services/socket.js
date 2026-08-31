// src/services/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket) return this.socket;

    try {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        console.log('⚡ [Socket.IO] Đã kết nối thành công tới Backend Server');
      });

      this.socket.on('disconnect', () => {
        console.log('⚠️ [Socket.IO] Mất kết nối tới Backend Server');
      });

      return this.socket;
    } catch (err) {
      console.warn('⚠️ [Socket.IO] Không thể khởi tạo socket connection:', err);
      return null;
    }
  }

  subscribe(event, callback) {
    if (!this.socket) {
      this.connect();
    }
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  unsubscribe(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
