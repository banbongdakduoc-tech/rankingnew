import readline from 'node:readline';
import bcrypt from 'bcryptjs';
if(!process.stdin.isTTY)throw new Error('Chạy trong terminal tương tác để tránh lộ mật khẩu trong lịch sử lệnh.');
process.stdout.write('Nhập mật khẩu (ẩn, tối thiểu 12 ký tự): ');
readline.emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);
let value='';
process.stdin.on('keypress',async(str,key)=>{
  if(key.ctrl&&key.name==='c'){process.stdin.setRawMode(false);process.exit(130);}
  if(key.name==='return'){
    process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');
    if(value.length<12){process.stderr.write('Mật khẩu quá ngắn.\n');process.exitCode=1;return;}
    process.stdout.write(`${await bcrypt.hash(value,12)}\n`);value='';
  }else if(key.name==='backspace')value=value.slice(0,-1);else if(str&&!key.ctrl)value+=str;
});
