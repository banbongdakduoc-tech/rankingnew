import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import { verifyToken, requireAdmin, authenticate } from './middleware/auth.js';
import { applyCommand, publicState, staffState, exportBackup, DomainError, initialState } from './services/stateEngine.js';
export function createApp(database,{broadcast=()=>{}}={}) {
  const app=express();app.set('db',database);app.disable('x-powered-by');app.set('trust proxy',Number(process.env.TRUST_PROXY_HOPS || 0));
  const allowed=(process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(x=>x.trim());
  app.use(cors({origin(origin,callback){callback(null,!origin || allowed.includes(origin));},credentials:false}));
  app.use(express.json({limit:'15mb'}));
  app.use((req,res,next)=>{res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');next();});
  app.get('/api/health',(req,res)=>res.json({status:'OK',schemaVersion:2}));
  app.use('/api/auth',authRoutes);
  app.get('/api/tournament/data',(req,res)=>{
    const data=database.getAll(),token=req.headers.authorization?.replace(/^Bearer /,'');
    if(!token)return res.json({success:true,data:publicState(data)});
    try{return res.json({success:true,data:staffState(data,authenticate(token,database))});}catch{return res.status(401).json({success:false,message:'Phiên hết hạn. Vui lòng đăng nhập lại.'});}
  });
  app.get('/api/seasons/:id',(req,res)=>{const season=database.get('seasons')?.[req.params.id];if(!season)return res.status(404).json({success:false,message:'Không tìm thấy mùa giải.'});res.json({success:true,data:publicState(initialState(season.data))});});
  app.post('/api/state/commands',verifyToken,async(req,res,next)=>{try{const state=await database.mutate(raw=>applyCommand(raw,req.body,req.user));broadcast(state);res.json({success:true,data:staffState(state,req.user)});}catch(e){next(e);}});
  app.get('/api/backup/export',requireAdmin,(req,res)=>res.attachment(`dpl_backup_${new Date().toISOString().slice(0,10)}.json`).json(exportBackup(database.getAll())));
  app.get('/api/backup/:id',requireAdmin,(req,res)=>{const backup=database.get('backups')?.[req.params.id];if(!backup)return res.status(404).json({message:'Không có backup.'});res.attachment(`dpl_backup_${backup.id}.json`).json(backup.snapshot);});
  // Removed legacy unrestricted mutation routes. All clients go through the validated command gateway.
  app.use('/api',(req,res)=>res.status(404).json({success:false,message:'Endpoint không còn hỗ trợ. Dùng command gateway v2.'}));
  app.use((err,req,res,next)=>{void next;const status=err instanceof DomainError?err.status:err.status || 500;res.status(status).json({success:false,message:status===500?'Không thể lưu dữ liệu. Vui lòng thử lại.':err.message});});
  return app;
}
