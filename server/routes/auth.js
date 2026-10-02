import express from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, verifyToken } from '../middleware/auth.js';
const router=express.Router(), attempts=new Map();
router.post('/login',async(req,res)=>{
  const key=req.ip,now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
  const attempt=attempts.get(key)||{count:0,until:now+15*60000};
  if(attempt.count>=20)return res.status(429).json({success:false,message:'Quá nhiều lần đăng nhập. Thử lại sau 15 phút.'});
  attempt.count++;attempts.set(key,attempt);
  const username=typeof req.body.username==='string'?req.body.username.trim().toLowerCase():'',password=req.body.password;
  const acc=req.app.get('db').get('accounts')?.[username];
  if(!acc||acc.disabled||typeof password!=='string'||!acc.passwordHash||!await bcrypt.compare(password,acc.passwordHash))return res.status(401).json({success:false,message:'Tài khoản hoặc mật khẩu không đúng.'});
  attempts.delete(key);const user={username,role:acc.role,name:acc.name || username,sessionVersion:acc.sessionVersion || 0};
  return res.json({success:true,user,token:generateToken(user)});
});
router.get('/me',verifyToken,(req,res)=>res.json({success:true,user:req.user}));
export default router;
