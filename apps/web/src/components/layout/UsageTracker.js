'use client';
import { useEffect,useRef,useState } from 'react';
import { usePathname } from 'next/navigation';
import { usageRoute } from '@coderank/contracts/usage';

export default function UsageTracker(){
 const path=usePathname(),last=useRef(null),[enabled,setEnabled]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  fetch('/api/usage/config',{cache:'no-store',credentials:'omit',signal:controller.signal}).then(response=>response.ok?response.json():null).then(data=>{if(!controller.signal.aborted)setEnabled(data?.enabled===true);}).catch(()=>{});
  return()=>controller.abort();
 },[]);
 useEffect(()=>{
  const route=usageRoute(path);
  if(!enabled||last.current===path)return;
  last.current=path;
  if(!route)return;
  void fetch('/api/usage/events',{method:'POST',credentials:'omit',keepalive:true,headers:{'Content-Type':'application/json','X-CodeRank-Usage':'1'},body:JSON.stringify({route})}).catch(()=>{});
 },[enabled,path]);
 return null;
}
