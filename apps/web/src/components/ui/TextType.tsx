"use client";
import {useEffect,useState} from "react";
export default function TextType({text=["RANK UP CODING"],typingSpeed=75,pauseDuration=1500,deletingSpeed=50,cursorColor="currentColor",prefixColor="currentColor",cursorCharacter="_",prefix="",showCursor=true}: {text?:string[];typingSpeed?:number;pauseDuration?:number;deletingSpeed?:number;cursorColor?:string;prefixColor?:string;cursorCharacter?:string;prefix?:string;showCursor?:boolean}) {
 const [count,setCount]=useState(0),[deleting,setDeleting]=useState(false),[reduced,setReduced]=useState(true);
 const value=text[0]??"";
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 useEffect(()=>{if(reduced)return;const timer=setTimeout(()=>{if(!deleting&&count===value.length)setDeleting(true);else if(deleting&&count===0)setDeleting(false);else setCount(c=>c+(deleting?-1:1));},!deleting&&count===value.length?pauseDuration:deleting?deletingSpeed:typingSpeed);return()=>clearTimeout(timer);},[count,deleting,reduced,value,typingSpeed,pauseDuration,deletingSpeed]);
 return <><span className="sr-only">{prefix}{value}</span><span aria-hidden="true"><span style={{color:prefixColor}}>{prefix}</span>{reduced?value:value.slice(0,count)}{showCursor&&<span className="typing-cursor" style={{color:cursorColor}}>{cursorCharacter}</span>}</span></>;
}
