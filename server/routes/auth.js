import express from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, verifyToken, requireAdmin } from '../middleware/auth.js';
import { randomUUID } from 'node:crypto';
import { deleteSecondaryAccount } from '../services/accounts.js';
const router=express.Router(), attempts=new Map();
router.post('/login',async(req,res)=>{
  const key=req.ip,now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
  const attempt=attempts.get(key)||{count:0,until:now+15*60000};
  if(attempt.count>=20)return res.status(429).json({success:false,message:'Quá nhiều lần đăng nhập. Thử lại sau 15 phút.'});
  attempt.count++;attempts.set(key,attempt);
  const username=typeof req.body.username==='string'?req.body.username.trim().toLowerCase():'',password=req.body.password;
  const acc=req.app.get('db').get('accounts')?.[username];
  if(!acc||acc.disabled||acc.deletedAt||typeof password!=='string'||Buffer.byteLength(password,'utf8')>72||!acc.passwordHash||!await bcrypt.compare(password,acc.passwordHash))return res.status(401).json({success:false,message:'Tài khoản hoặc mật khẩu không đúng.'});
  attempts.delete(key);const user={username,role:acc.role,name:acc.name || username,sessionVersion:acc.sessionVersion || 0};
  return res.json({success:true,user,token:generateToken(user)});
});
router.get('/me',verifyToken,(req,res)=>res.json({success:true,user:req.user}));
router.post('/accounts',requireAdmin,async(req,res,next)=>{
  try {
    const username=typeof req.body.username==='string'?req.body.username.trim().toLowerCase():'';
    const name=typeof req.body.name==='string'?req.body.name.trim():'';
    const password=req.body.password;
    const role=req.body.role || 'referee';
    if(!['referee','approver'].includes(role))return res.status(422).json({success:false,message:'Chỉ tạo tài khoản thư ký hoặc admin phụ duyệt biên bản.'});
    if(['__proto__','constructor','prototype'].includes(username)||!/^[a-z0-9_-]{3,40}$/.test(username)||!name||name.length>100||typeof password!=='string'||password.length<12||Buffer.byteLength(password,'utf8')>72)return res.status(422).json({success:false,message:'Tên đăng nhập: 3–40 chữ thường, số, dấu _ hoặc -. Tên hiển thị tối đa 100 ký tự. Mật khẩu ít nhất 12 ký tự, tối đa 72 byte.'});
    const passwordHash=await bcrypt.hash(password,12);
    const database=req.app.get('db');
    const state=await database.mutate(raw=>{
      if(Object.hasOwn(raw.accounts,username)){const error=new Error('Tên đăng nhập đã được sử dụng; tên tài khoản đã xóa được giữ để bảo toàn lịch sử.');error.status=409;throw error;}
      raw.accounts[username]={name,role,passwordHash,sessionVersion:0};
      raw._version=(raw._version||0)+1;
      raw.audit=[...(raw.audit||[]),{id:randomUUID(),at:new Date().toISOString(),by:req.user.username,role:'admin',kind:role==='approver'?'create_approver':'create_secretary',reason:`Tạo tài khoản ${role==='approver'?'admin phụ':'thư ký'} ${username}`}].slice(-1000);
      return raw;
    });
    req.app.get('broadcast')?.(state);
    res.status(201).json({success:true,user:{username,name,role}});
  }catch(e){next(e);}
});
router.delete('/accounts/:username',requireAdmin,async(req,res,next)=>{
  try {
    const username=req.params.username;
    const state=await req.app.get('db').mutate(raw=>deleteSecondaryAccount(raw,username,req.body?.confirmation,req.user));
    req.app.get('broadcast')?.(state);
    res.json({success:true,message:'Đã xóa tài khoản và thu hồi phiên đăng nhập.'});
  }catch(e){next(e);}
});
export default router;
