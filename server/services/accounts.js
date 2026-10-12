import { randomUUID } from 'node:crypto';
import { DomainError } from './stateEngine.js';

export function deleteSecondaryAccount(state, username, confirmation, actor) {
  if(actor.role!=='admin')throw new DomainError('Chỉ admin chính được xóa tài khoản.',403);
  if(username===actor.username)throw new DomainError('Không được xóa tài khoản đang đăng nhập.',403);
  if(typeof username!=='string'||!Object.hasOwn(state.accounts,username))throw new DomainError('Không tìm thấy tài khoản.',404);
  const account=state.accounts[username];
  if(!['referee','approver'].includes(account.role))throw new DomainError('Chỉ được xóa tài khoản thư ký hoặc admin phụ.',403);
  if(confirmation!==username)throw new DomainError('Nhập đúng tên đăng nhập để xác nhận xóa.');
  if(account.deletedAt)return state;
  const assigned=Object.values(state.matches||{}).filter(m=>m.assignedSecretary===username);
  if(assigned.some(m=>!['Sắp diễn ra','Đã xong'].includes(m.status)))throw new DomainError('Tài khoản còn trận đang tác nghiệp hoặc biên bản chưa hoàn tất. Hãy duyệt xong hoặc phân công thư ký khác trước khi xóa.',409);
  const now=new Date().toISOString();
  // Keep a disabled tombstone: historical attribution and old JWTs must never
  // become valid again if someone tries to reuse the same username.
  account.disabled=true;account.deletedAt=now;account.deletedBy=actor.username;
  account.sessionVersion=(account.sessionVersion||0)+1;
  delete account.password;delete account.passwordHash;
  for(const match of assigned.filter(m=>m.status==='Sắp diễn ra')){
    match.assignedSecretary='';match.version=(match.version||0)+1;
  }
  state._version=(state._version||0)+1;
  state.audit=[...(state.audit||[]),{id:randomUUID(),at:now,by:actor.username,role:actor.role,kind:'delete_account',reason:`Xóa tài khoản ${username}; thu hồi quyền và phiên đăng nhập`}].slice(-1000);
  return state;
}
