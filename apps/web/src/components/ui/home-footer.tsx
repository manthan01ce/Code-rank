import Link from "next/link";
// Original two-row fallback. Licensed React Bits Footer 6 installation is pending.
export default function HomeFooter(){return <footer className="home-footer"><nav aria-label="Footer navigation"><Link href="/">Home</Link><Link href="/practice">Practice</Link><Link href="/login">Sign in</Link></nav><div><strong>CodeRank</strong><span>Institutional Code Assessment Engine</span><small>© {new Date().getFullYear()} CodeRank. All rights reserved.</small></div></footer>;}
