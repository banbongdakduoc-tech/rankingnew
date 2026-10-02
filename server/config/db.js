import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import bcrypt from 'bcryptjs';
import { migrateState } from '../services/migrateState.js';
import { initialState } from '../services/stateEngine.js';

export class Database {
  constructor({mode=process.env.DB_MODE || 'firebase',file=process.env.DPL_DB_FILE || 'server/storage/dpl_database.json',data}={}) {
    this.mode=mode;this.file=path.resolve(file);this.data=initialState(data);this.serial=Promise.resolve();this.listeners=new Set();
  }
  async init() {
    if(this.mode==='firebase') {
      if(!process.env.FIREBASE_DATABASE_URL || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON || !process.env.DPL_DATABASE_PATH)throw new Error('Thiếu cấu hình Firebase demo. Cần FIREBASE_DATABASE_URL, FIREBASE_SERVICE_ACCOUNT_JSON và DPL_DATABASE_PATH.');
      if(!/^environments\/demo(?:[-_a-zA-Z0-9]*)(?:\/|$)/.test(process.env.DPL_DATABASE_PATH))throw new Error('Nhánh demo chỉ được ghi vào environments/demo…; không dùng root của giải thật.');
      const app=getApps()[0] || initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),databaseURL:process.env.FIREBASE_DATABASE_URL});
      this.root=getDatabase(app).ref(process.env.DPL_DATABASE_PATH);
      const snapshot=await this.root.get();this.data=migrateState(snapshot.val() || {});
    } else if(this.mode==='file') {
      if(process.env.NODE_ENV==='production')throw new Error('Không cho phép lưu file trong production.');
      if(fs.existsSync(this.file))this.data=initialState(JSON.parse(fs.readFileSync(this.file,'utf8')));
    } else if(this.mode!=='memory')throw new Error('DB_MODE không hợp lệ.');
    const hashes=new Map();
    const migrate=raw=>{const next=migrateState(raw);for(const account of Object.values(next.accounts || {})){if(account.password&&!account.passwordHash){if(!hashes.has(account.password))hashes.set(account.password,bcrypt.hashSync(account.password,12));account.passwordHash=hashes.get(account.password);}delete account.password;}return next;};
    // A transaction preserves writes from other instances during startup migration.
    await this.mutate(migrate);
    if(this.root)this.root.on('value',snapshot=>{this.data=initialState(snapshot.val() || {});for(const listener of this.listeners)listener(this.getAll());});
    return this;
  }
  subscribe(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
  getAll(){return structuredClone(this.data);}
  get(key){return structuredClone(this.data[key]);}
  async persist(data){
    const clean=JSON.parse(JSON.stringify(data));
    if(this.root)await this.root.set(clean);
    if(this.mode==='file'){fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(`${this.file}.tmp`,JSON.stringify(clean,null,2),{mode:0o600});fs.renameSync(`${this.file}.tmp`,this.file);}
    this.data=clean;
  }
  mutate(transform){
    const work=async()=>{
      if(this.root){
        let domainError;
        const result=await this.root.transaction(raw=>{domainError=undefined;try{return JSON.parse(JSON.stringify(transform(initialState(raw || {}))));}catch(e){domainError=e;return; }},undefined,false);
        if(domainError)throw domainError;if(!result.committed)throw new Error('Không thể lưu dữ liệu.');this.data=initialState(result.snapshot.val());
      } else {const next=transform(this.getAll());await this.persist(next);}
      return this.getAll();
    };
    const result=this.serial.then(work);this.serial=result.catch(()=>{});return result;
  }
}
export const db=new Database();
