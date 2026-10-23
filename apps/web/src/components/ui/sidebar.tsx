"use client";
import {createContext,useContext,useState,useEffect,type ReactNode} from "react";
import Link from "next/link";
import {IconMenu2,IconX} from "@tabler/icons-react";
import {cn} from "@/lib/utils";
const Context=createContext<{open:boolean;setOpen:(open:boolean)=>void}|null>(null);
export function useSidebar(){const value=useContext(Context);if(!value)throw Error('Sidebar provider required');return value;}
export function SidebarProvider({children}:{children:ReactNode}){const [open,setOpen]=useState(false);return <Context.Provider value={{open,setOpen}}>{children}</Context.Provider>;}
export const Sidebar=SidebarProvider;
export function DesktopSidebar({children}:{children:ReactNode}){return <aside className="admin-desktop-sidebar" aria-label="Admin navigation">{children}</aside>;}
export function MobileSidebar({children}:{children:ReactNode}){const {open,setOpen}=useSidebar();useEffect(()=>{if(!open)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Tab') {
 const nodes=Array.from(document.querySelectorAll<HTMLElement>('#admin-mobile-menu a, #admin-mobile-menu button'));
 const first=nodes[0],last=nodes.at(-1);
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 }
 if(e.key==='Escape'){setOpen(false);document.getElementById('admin-menu-toggle')?.focus();}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[open,setOpen]);return <div className="admin-mobile-sidebar"><button id="admin-menu-toggle" type="button" aria-label="Open admin menu" aria-expanded={open} aria-controls="admin-mobile-menu" onClick={()=>setOpen(true)}><IconMenu2/></button>{open&&<div id="admin-mobile-menu" role="dialog" aria-modal="true" aria-label="Admin menu" className="admin-mobile-menu"><button autoFocus type="button" aria-label="Close admin menu" onClick={()=>{setOpen(false);document.getElementById('admin-menu-toggle')?.focus();}}><IconX/></button>{children}</div>}</div>;}
export function SidebarBody({children}:{children:ReactNode}){return <><DesktopSidebar>{children}</DesktopSidebar><MobileSidebar>{children}</MobileSidebar></>;}
export function SidebarLink({href,label,icon,active=false}:{href:string;label:string;icon:ReactNode;active?:boolean}){const {setOpen}=useSidebar();return <Link href={href} aria-label={label} aria-current={active?'page':undefined} className={cn('admin-nav-link',active&&'is-active')} onClick={()=>setOpen(false)}>{icon}<span>{label}</span></Link>;}
