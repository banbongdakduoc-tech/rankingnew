import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
const secret=process.env.JWT_SECRET || (process.env.NODE_ENV!=='production'?randomBytes(48).toString('hex'):'');
if(secret.length<32)throw new Error('JWT_SECRET phải có ít nhất 32 ký tự, không dùng giá trị mặc định.');
export function generateToken(user){return jwt.sign({username:user.username,role:user.role,name:user.name,sessionVersion:user.sessionVersion || 0},secret,{expiresIn:'12h',issuer:'dpl-api',audience:'dpl-web'});}
export function authenticate(token,database){
  const decoded=jwt.verify(token,secret,{issuer:'dpl-api',audience:'dpl-web',algorithms:['HS256']});
  const acc=database.get('accounts')?.[decoded.username];
  if(!acc || acc.disabled || acc.role!==decoded.role || (acc.sessionVersion || 0)!==decoded.sessionVersion)throw new Error('Phiên đăng nhập đã bị thu hồi.');
  return {...decoded,name:acc.name || decoded.username};
}
export function verifyToken(req,res,next){try{const token=req.headers.authorization?.replace(/^Bearer /,'');if(!token)return res.status(401).json({success:false,message:'Yêu cầu đăng nhập.'});req.user=authenticate(token,req.app.get('db'));next();}catch{return res.status(401).json({success:false,message:'Phiên hết hạn hoặc đã bị thu hồi. Vui lòng đăng nhập lại.'});}}
export function requireAdmin(req,res,next){verifyToken(req,res,()=>req.user.role==='admin'?next():res.status(403).json({success:false,message:'Chỉ Ban tổ chức được thực hiện.'}));}
export function requireStaff(req,res,next){verifyToken(req,res,()=>['admin','referee'].includes(req.user.role)?next():res.status(403).json({success:false,message:'Yêu cầu quyền tác nghiệp.'}));}
