import Link from "next/link";
import Image from "next/image";

export default function SignUp() {
  return <main className="auth-shell auth-refined auth-focused"><section className="auth-form auth-account-info">
    <Link href="/" className="auth-brand"><Image src="/coderank-logo.jpg" width={38} height={38} alt=""/><span>Code<span className="auth-brand-accent">Rank</span></span></Link>
    <div><h1>Your learning starts here.</h1><p className="auth-description">Your institution provides your CodeRank account. Contact your faculty or administrator to receive your sign-in credentials.</p></div>
    <div className="auth-access-note"><strong>Already received your credentials?</strong><p>Sign in to access your assigned courses and practicals.</p></div>
    <Link href="/login" className="auth-submit">Go to sign in ↗</Link>
    <footer className="auth-page-footer"><Link href="/">← Back to CodeRank</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Usage guidelines</Link><Link href="/contact">Support</Link></footer>
  </section></main>;
}
