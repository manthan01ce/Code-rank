"use client";
import { useState, type ReactNode, type FormEvent } from "react";
import { Eye, EyeOff, ArrowUpRight, BookOpen, Code2, Check } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export interface Testimonial { avatarSrc: string; name: string; handle: string; text: string }
interface Props { title?: ReactNode; description?: ReactNode; heroImageSrc?: string; testimonials?: Testimonial[]; onSignIn: (event: FormEvent<HTMLFormElement>) => void; onGoogleSignIn?: () => void; onResetPassword?: () => void; onCreateAccount?: () => void; loading?: boolean; error?: string }
export function SignInPage({ title = "Welcome back", description = "Sign in to continue your CodeRank journey.", onSignIn, onGoogleSignIn, onResetPassword, loading = false, error }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  return <main className="auth-shell auth-refined">
    <section className="auth-form">
      <Link href="/" className="auth-brand"><Image src="/coderank-logo.jpg" width={38} height={38} alt=""/><span>Code<span className="auth-brand-accent">Rank</span></span></Link>
      <div><p className="auth-eyebrow">YOUR CODING WORKSPACE</p><h1>{title}</h1><p className="auth-description">{description}</p></div>
      <form onSubmit={onSignIn} aria-busy={loading}>
        <div><label htmlFor="login-email">Username or email</label><input id="login-email" name="email" required autoComplete="username" maxLength={254} placeholder="Enter your username or email"/></div>
        <div><label htmlFor="login-password">Password</label><div className="password-field"><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" maxLength={1024} placeholder="Enter your password"/><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>
        {error && <p role="alert" className="auth-error">{error}</p>}
        <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in to your workspace'}<ArrowUpRight size={17} aria-hidden="true"/></button>
      </form>
      <div className="auth-links">{onResetPassword ? <button type="button" onClick={onResetPassword}>Reset password</button> : <p>Password help? Contact your faculty or administrator.</p>}{onGoogleSignIn && <button type="button" onClick={onGoogleSignIn}>Continue with Google</button>}</div>
      <footer className="auth-page-footer"><Link href="/">← Back to CodeRank</Link><span>Learn. Practice. Progress.</span></footer>
    </section>
    <section className="auth-story" aria-labelledby="auth-story-title"><div className="auth-story-top"><span className="auth-eyebrow">BUILT FOR THE UNIVERSITY CODING LAB</span><Code2 size={24} aria-hidden="true"/></div><h2 id="auth-story-title">A little practice.<br/>A new <span>possibility.</span></h2><p>One connected space for practical learning, thoughtful feedback, and your next breakthrough.</p>
      <div className="auth-learning-card"><div className="auth-learning-heading"><BookOpen size={18} aria-hidden="true"/><span>Your learning journey</span><span className="auth-learning-symbol" aria-hidden="true">{'{ }'}</span></div>{[['01', 'Explore the idea', 'Understand the problem. Find your approach.'], ['02', 'Put it into practice', 'Write, run, and refine your solution.'], ['03', 'See your progress', 'Learn from feedback and keep building.']].map(([number, title, detail]) => <div className="auth-learning-step" key={number}><span>{number}</span><div><strong>{title}</strong><p>{detail}</p></div><Check size={15} aria-hidden="true"/></div>)}</div>
      <div className="auth-story-bottom"><span>C · C++ · Java · Python</span><span>Practice with purpose.</span></div>
    </section>
  </main>;
}
