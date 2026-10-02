import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { initialState, reportHash } from '../services/stateEngine.js';
import { generateRoundRobinMatches } from '../../shared/tournament.js';
const target=process.env.DPL_DB_FILE;
if(!target || !target.includes('demo') || process.env.DB_MODE!=='file')throw new Error('Seed chỉ được ghi file demo với DB_MODE=file và DPL_DB_FILE có chữ demo.');
if(fs.existsSync(target))throw new Error('File demo đã có. Chọn một đường dẫn mới để không ghi đè.');
if(!process.env.DPL_DEMO_PASSWORD || process.env.DPL_DEMO_PASSWORD.length<12)throw new Error('Đặt DPL_DEMO_PASSWORD ít nhất 12 ký tự trong môi trường local.');
const groupsData=[{groupName:'Bảng A',teams:['Dược K21','Dược K22','Dược K23','Dược K24']},{groupName:'Bảng B',teams:['Dược K25','Dược K26','Dược K27','Dược K28']}];
const state=initialState({tourStatus:'active',groupsData});
for(const team of groupsData.flatMap(g=>g.teams))state.players[team]=[1,7,10].map((num,i)=>({id:crypto.randomUUID(),team,num,name:['Trần Văn Hùng','Nguyễn Minh Anh','Lê Hoàng Nam'][i],shirtName:['V.HÙNG','M.ANH','H.NAM'][i],avatar:''}));
state.matches=generateRoundRobinMatches(groupsData);
for(const [i,m] of Object.values(state.matches).entries()){
  m.date=new Date(Date.UTC(2026,9,2,1+i*3)).toISOString();m.venue='Sân Trường Dược';m.assignedSecretary='thuky';m.ref='Trọng tài demo';m.sec='Thư ký demo';m.lineupA=state.players[m.home].map(p=>({...p,played:true}));m.lineupB=state.players[m.away].map(p=>({...p,played:true}));
  if(i<3){m.status='Đã xong';m.scoreA=1;m.events=[{id:crypto.randomUUID(),type:'goal',detail:'normal',team:m.home,player:'10 - Lê Hoàng Nam',playerId:state.players[m.home][2].id,minute:12,period:1,displayMinute:"12'"}];m.signatureException='Dữ liệu minh họa local';m.signatureHash=reportHash(m);}
  if(i===3){m.status='Đang LIVE';m.clock={elapsed:720,startedAt:Date.now(),running:true,period:1};}
  if(i===4){m.status='Chờ duyệt';m.signatureException='Dữ liệu minh họa local';m.signatureHash=reportHash(m);}
}
const passwordHash=await bcrypt.hash(process.env.DPL_DEMO_PASSWORD,12);
state.accounts={admin:{role:'admin',name:'Ban tổ chức demo',passwordHash},thuky:{role:'referee',name:'Thư ký demo',passwordHash}};
fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(state,null,2),{mode:0o600});console.log('Đã tạo dataset demo local. Không truy cập database giải thật.');
