import { request, reconnectData } from './dataService';
export async function loginUser(username,password){
  try {const res=await request('/api/auth/login',{method:'POST',body:JSON.stringify({username,password})});localStorage.setItem('dpl_token',res.token);localStorage.setItem('dpl_user',JSON.stringify(res.user));localStorage.removeItem('dpl_auth_session');reconnectData();return res;}
  catch(e){return {success:false,message:e.message};}
}
export function getSavedSession(){try {return localStorage.getItem('dpl_token')?JSON.parse(localStorage.getItem('dpl_user') || 'null'):null;}catch{return null;}}
export function clearSession(){localStorage.removeItem('dpl_token');localStorage.removeItem('dpl_user');localStorage.removeItem('dpl_auth_session');reconnectData();}
export async function verifySavedSession(){if(!localStorage.getItem('dpl_token'))return null;try{return (await request('/api/auth/me')).user;}catch(e){if(e.status===401){clearSession();return null;}return {...getSavedSession(),offline:true};}}
