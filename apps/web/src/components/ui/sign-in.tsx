"use client";
import {useState,type ReactNode,type FormEvent} from "react";
import {Eye,EyeOff} from "lucide-react";
import Link from "next/link";
export interface Testimonial {avatarSrc:string;name:string;handle:string;text:string}
interface Props {title?:ReactNode;description?:ReactNode;heroImageSrc?:string;testimonials?:Testimonial[];onSignIn:(event:FormEvent<HTMLFormElement>)=>void;onGoogleSignIn?:()=>void;onResetPassword?:()=>void;onCreateAccount?:()=>void;loading?:boolean;error?:string}
export function SignInPage({title="Welcome back",description="Sign in to your CodeRank account.",heroImageSrc,testimonials=[],onSignIn,onGoogleSignIn,onResetPassword,onCreateAccount,loading=false,error}:Props){
 const [showPassword,setShowPassword]=useState(false);
 return <main className="auth-shell bg-background text-foreground"><section className="auth-form"><Link href="/" className="auth-brand">CodeRank</Link><h1 className="animate-element">{title}</h1><p className="text-muted-foreground">{description}</p><form onSubmit={onSignIn} aria-busy={loading}>
 <div><label htmlFor="login-email">Username or Email</label><input id="login-email" name="email" required autoComplete="username" maxLength={254} placeholder="Enter your username or email"/></div>
 <div><label htmlFor="login-password">Password</label><div className="password-field"><input id="login-password" name="password" type={showPassword?'text':'password'} required autoComplete="current-password" maxLength={1024}/><button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={20}/>:<Eye size={20}/>}</button></div></div>
 {error&&<p role="alert" className="auth-error">{error}</p>}
 <button type="submit" className="auth-submit" disabled={loading}>{loading?'Signing in…':'Sign In →'}</button>
 </form><div className="auth-links">{onResetPassword?<button type="button" onClick={onResetPassword}>Reset password</button>:<p>Password help: contact your faculty or administrator.</p>}{onGoogleSignIn&&<button type="button" onClick={onGoogleSignIn}>Continue with Google</button>}{onCreateAccount?<button type="button" onClick={onCreateAccount}>Create Account</button>:<Link href="/signup">Need an account?</Link>}</div></section>
 {heroImageSrc&&<section className="auth-visual animate-slide-right" aria-label="Coding workspace"><img src={heroImageSrc} alt="A computer displaying code"/><div className="auth-visual-caption"><h2>Rank up your coding.</h2><p>Practice, learn and complete your institutional assessments.</p>{testimonials.map(t=><blockquote key={t.name}><p>{t.text}</p><cite>{t.name} · {t.handle}</cite></blockquote>)}</div></section>}
 </main>;
}
