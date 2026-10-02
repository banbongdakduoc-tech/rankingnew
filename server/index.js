import 'dotenv/config';
import http from 'node:http';
import { Server } from 'socket.io';
import { db } from './config/db.js';
import { createApp } from './app.js';
import { authenticate } from './middleware/auth.js';
import { publicState, staffState } from './services/stateEngine.js';
await db.init();
let io;
function broadcast(state){for(const socket of io?.sockets.sockets.values() || []){try{const user=socket.handshake.auth?.token?authenticate(socket.handshake.auth.token,db):null;socket.emit('db_changed',user?staffState(state,user):publicState(state));}catch{socket.emit('session_expired');socket.disconnect(true);}}}
db.subscribe(broadcast);
const app=createApp(db,{broadcast}),server=http.createServer(app);
io=new Server(server,{cors:{origin:(process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(s=>s.trim()),methods:['GET','POST']},maxHttpBufferSize:15e6});
io.use((socket,next)=>{try{if(socket.handshake.auth?.token)authenticate(socket.handshake.auth.token,db);next();}catch{next(new Error('Phiên hết hạn.'));}});
io.on('connection',socket=>{const user=socket.handshake.auth?.token?authenticate(socket.handshake.auth.token,db):null;socket.emit('initial_data',user?staffState(db.getAll(),user):publicState(db.getAll()));});
const port=Number(process.env.PORT || 5000);server.listen(port,()=>console.log(`DPL API sẵn sàng ở cổng ${port}; nguồn dữ liệu: ${process.env.DB_MODE || 'firebase'}`));
