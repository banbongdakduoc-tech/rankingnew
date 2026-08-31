import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import { db } from './config/db.js';
import authRoutes from './routes/auth.js';
import tournamentRoutes from './routes/tournament.js';
import matchesRoutes from './routes/matches.js';
import playersRoutes from './routes/players.js';
import disciplineRoutes from './routes/discipline.js';
import backupRoutes from './routes/backup.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || '*';

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL === '*' ? '*' : [CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

app.set('io', io);

// Middleware
app.use(cors({
  origin: CLIENT_URL === '*' ? '*' : [CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    app: 'Dược Premier League Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/tournament', tournamentRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/discipline', disciplineRoutes);
app.use('/api/backup', backupRoutes);

// Socket.IO Realtime Connection
io.on('connection', (socket) => {
  console.log(`🔌 [Socket.IO] Client kết nối: ${socket.id}`);

  // Gửi toàn bộ dữ liệu ban đầu cho client mới kết nối
  socket.emit('initial_data', db.getAll());

  socket.on('disconnect', () => {
    console.log(`🔌 [Socket.IO] Client ngắt kết nối: ${socket.id}`);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Dược Premier League Backend Server đang chạy`);
  console.log(`📡 Cổng: http://localhost:${PORT}`);
  console.log(`🛡️  Bảo mật: JWT Auth + An Toàn Dữ Liệu`);
  console.log(`====================================================`);
});
