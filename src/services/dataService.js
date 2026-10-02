import { io } from 'socket.io-client';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const skewKey=`dpl-server-skew-${API}`;
let timeSkew=Number(localStorage.getItem(skewKey)) || 0;
export const serverTimeOffset=()=>timeSkew;
export const db = Object.freeze({});
let state = {}, loaded = false, socket, flushing = false, connecting = false;
const subscriptions = new Set(), metaListeners = new Set();
let meta = { connected:false, loading:true, pending:0, conflicts:[], error:'', updatedAt:null };
const token = () => localStorage.getItem('dpl_token');
const user = () => {try{return JSON.parse(localStorage.getItem('dpl_user') || 'null');}catch{return null;}};
export function ref(_db,path = '') {return {path:path.replace(/^\/+|\/+$/g,'')};}
const valueAt = path => path ? path.split('/').reduce((v,p)=>v?.[p],state) : state;
function publish(){for(const sub of subscriptions){const value=valueAt(sub.path);sub.callback({val:()=>structuredClone(value ?? null),exists:()=>value!=null});}}
function status(patch){meta={...meta,...patch};for(const fn of metaListeners)fn(meta);}
export function subscribeSync(fn){metaListeners.add(fn);fn(meta);return()=>metaListeners.delete(fn);}
export function syncSnapshot(){return meta;}
function accept(data,{cached=false}={}){if(!data || data.schemaVersion!==2)return;if(!cached&&Number.isFinite(data.serverTime)){timeSkew=data.serverTime-Date.now();localStorage.setItem(skewKey,String(timeSkew));}state=data;loaded=true;status({loading:false,error:'',updatedAt:Date.now()});publish();cacheState('put',{id:user()?.username || 'public',data}).catch(()=>status({error:'Không lưu được bản xem offline. Kiểm tra bộ nhớ trình duyệt.'}));}
export async function request(endpoint,options={}) {
  const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),20000);
  try {
    const response=await fetch(`${API}${endpoint}`,{...options,headers:{'Content-Type':'application/json',...(token()?{Authorization:`Bearer ${token()}`}:{})},signal:controller.signal});
    const data=await response.json();if(!response.ok){const error=new Error(data.message || `HTTP ${response.status}`);error.status=response.status;throw error;}return data;
  } finally {clearTimeout(timeout);}
}
export async function refreshData(){try{const response=await request('/api/tournament/data');if(response.data?.schemaVersion!==2)throw new Error('Backend chưa hỗ trợ phiên bản demo v2. Cần cấu hình backend demo trước.');accept(response.data);}catch(e){status({loading:false,error:e.message});throw e;}}
async function connect(){
  if(socket || connecting)return;
  connecting=true;
  try {
    await updateQueueStatus();
    const cached=await cacheState('get',user()?.username || 'public');if(cached&&!loaded)accept(cached.data,{cached:true});
    const health=await request('/api/health');if(health.schemaVersion!==2)throw new Error('Backend hiện tại chưa hỗ trợ demo v2. Không gửi dữ liệu giải vào API cũ.');
  } catch(e) {status({loading:false,connected:false,error:loaded?'Đang dùng bản lưu trên máy · Chưa có kết nối máy chủ':e.message});connecting=false;return;}
  socket=io(API,{auth:{token:token()},reconnection:true,reconnectionDelay:1000});
  socket.on('connect',()=>{status({connected:true,error:''});flushQueue();});
  socket.on('disconnect',()=>status({connected:false}));
  socket.on('initial_data',accept);socket.on('db_changed',accept);
  socket.on('connect_error',e=>status({connected:false,loading:false,error:e.message==='Phiên hết hạn.'?e.message:'Không kết nối được backend.'}));
  socket.on('session_expired',()=>{localStorage.removeItem('dpl_token');localStorage.removeItem('dpl_user');window.dispatchEvent(new Event('dpl-session'));status({connected:false,error:'Phiên đã bị thu hồi. Đăng nhập lại để gửi nháp.'});});
  refreshData().catch(()=>{});connecting=false;
}
export function reconnectData(){socket?.disconnect();socket=null;connecting=false;state={};loaded=false;status({loading:true});connect();}
export function onValue(reference,callback){const sub={path:reference.path,callback};subscriptions.add(sub);connect();if(loaded){const value=valueAt(sub.path);callback({val:()=>structuredClone(value ?? null),exists:()=>value!=null});}return()=>subscriptions.delete(sub);}

// Commands are saved to IndexedDB before network transmission, and retained after conflicts.
let queueDB;
async function openQueue(){if(queueDB)return queueDB;queueDB=await new Promise((resolve,reject)=>{const req=indexedDB.open('dpl-command-queue-v2',2);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('commands'))req.result.createObjectStore('commands',{keyPath:'id'});if(!req.result.objectStoreNames.contains('cache'))req.result.createObjectStore('cache',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('Không mở được bộ nhớ nháp. Kiểm tra quyền lưu trữ trình duyệt.'));});return queueDB;}
async function cacheState(method,value){const database=await openQueue();return new Promise((resolve,reject)=>{const tx=database.transaction('cache',method==='get'?'readonly':'readwrite'),store=tx.objectStore('cache'),req=method==='get'?store.get(value):store.put(value);let result;req.onsuccess=()=>result=req.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}
async function queueStore(method,data){const database=await openQueue();return new Promise((resolve,reject)=>{const tx=database.transaction('commands',method==='getAll'?'readonly':'readwrite'),store=tx.objectStore('commands');const req=method==='getAll'?store.getAll():method==='put'?store.put(data):store.delete(data);let result;req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}
async function updateQueueStatus(){const entries=await queueStore('getAll');const mine=entries.filter(x=>x.owner===user()?.username);status({pending:mine.filter(x=>!x.conflict).length,conflicts:mine.filter(x=>x.conflict)}); if (loaded) publish();}
export async function discardConflict(id){await queueStore('delete',id);await updateQueueStatus();}
export async function exportLocalQueue(){return (await queueStore('getAll')).filter(x=>x.owner===user()?.username);}
export async function flushQueue(){
  if(flushing||!token()||!navigator.onLine||!meta.connected)return;
  flushing=true;
  try {
    const commands=(await queueStore('getAll')).filter(x=>x.owner===user()?.username && !x.conflict).sort((a,b)=>a.createdAt-b.createdAt);
    for(const entry of commands){
      try{const result=await request('/api/state/commands',{method:'POST',body:JSON.stringify({...entry.command,clientNow:Date.now()})});accept(result.data);await queueStore('delete',entry.id);}
      catch(e){if(e.status){entry.conflict=e.message;await queueStore('put',entry);status({error:e.message});if(e.status===401)break;}else {status({connected:false,error:'Thao tác đã lưu trên máy, đang chờ gửi lại.'});break;}}
    }
  } finally {flushing=false;await updateQueueStatus();}
}
window.addEventListener('online',()=>{if(!socket)connect();flushQueue();});
setInterval(()=>{if(!socket&&!connecting&&navigator.onLine&&subscriptions.size)connect();},10000);
export async function sendCommand(command,{offline=false}={}) {
  command={...command,id:command.id || crypto.randomUUID()};
  if(!token())throw new Error('Đăng nhập lại trước khi lưu.');
  if(!offline){if(!meta.connected||!navigator.onLine)throw new Error('Cần kết nối máy chủ cho thao tác này.');await flushQueue();if(meta.pending||meta.conflicts.length)throw new Error('Giải quyết thao tác chờ gửi hoặc xung đột trước khi tiếp tục.');const result=await request('/api/state/commands',{method:'POST',body:JSON.stringify({...command,clientNow:Date.now()})});accept(result.data);return {queued:false};}
  const earlier=(await queueStore('getAll')).filter(x=>x.owner===user().username&&!x.conflict).sort((a,b)=>b.createdAt-a.createdAt);
  if(command.kind==='patch') { command.predecessors={}; for(const id of Object.keys(command.versions||{})){const previous=earlier.find(x=>x.command.matchId===id || x.command.versions?.[id]!==undefined);if(previous)command.predecessors[id]=previous.command.id;} }
  const entry={id:command.id,owner:user().username,createdAt:Date.now(),command};await queueStore('put',entry);await updateQueueStatus();
  await flushQueue();const remaining=(await queueStore('getAll')).find(x=>x.id===entry.id);if(remaining?.conflict)throw new Error(remaining.conflict);return {queued:!!remaining};
}
function patchesFor(path,data,merge){
  if(merge && data && typeof data==='object' && !Array.isArray(data))return Object.fromEntries(Object.entries(data).map(([k,v])=>[path?`${path}/${k}`:k,v]));
  return {[path]:data};
}
async function write(reference,data,merge=false){
  const path=reference.path,matchId=path.startsWith('matches/')?path.split('/')[1]:null;
  const match=matchId?state.matches?.[matchId]:null;
  if(matchId && data?.events && user()?.role==='referee') {
    const existing=new Map((match?.events||[]).map(e=>[String(e.id),e]));
    const add=data.events.filter(e=>!existing.has(String(e.id))),remove=(match?.events||[]).filter(e=>!e.cancelled&&!data.events.some(x=>String(x.id)===String(e.id))).map(e=>e.id);
    return sendCommand({kind:'events',matchId,baseVersion:match?.version||0,add,remove},{offline:true});
  }
  const patches=patchesFor(path,data,merge),versions={};for(const p of Object.keys(patches)){const id=p.startsWith('matches/')?p.split('/')[1]:null;if(id)versions[id]=state.matches?.[id]?.version || 0;}
  const offline=!!matchId && user()?.role==='referee' && !['Chờ duyệt','Đã xong'].includes(data?.status);
  return sendCommand({kind:'patch',patches,versions,expectedVersion:state._version||0},{offline});
}
export const set=(reference,data)=>write(reference,data);
export const update=(reference,data)=>write(reference,data,true);
export const remove=reference=>write(reference,null);
export async function reopenMatch(match,reason){return sendCommand({kind:'reopen',matchId:match.id,version:match.version||0,reason});}
export async function importBackup(data){return sendCommand({kind:'restore',data,expectedVersion:state._version || 0});}
export async function resetTournament(confirmation){return sendCommand({kind:'reset',confirmation,expectedVersion:state._version || 0});}
export async function downloadBackup(id){const response=await fetch(`${API}/api/backup/${id || 'export'}`,{headers:{Authorization:`Bearer ${token()}`}});if(!response.ok)throw new Error('Không tải được backup.');return response.blob();}
