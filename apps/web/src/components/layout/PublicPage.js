import Link from 'next/link';
import styles from './PublicPage.module.css';

export default function PublicPage({ title, intro, children }) {
  return <div className={styles.shell}>
    <a href="#public-content" className={styles.skip}>Skip to content</a>
    <header className={styles.header}><Link href="/" className={styles.brand}>Code<span>Rank</span></Link><Link href="/login" className={styles.action}>Sign in ↗</Link></header>
    <main id="public-content" className={styles.main}><h1>{title}</h1><p className={styles.intro}>{intro}</p><div className={styles.content}>{children}</div></main>
    <footer className={styles.footer}><span>CodeRank · Learn. Practice. Progress.</span><nav aria-label="Information and support"><Link href="/privacy">Privacy</Link><Link href="/terms">Usage guidelines</Link><Link href="/contact">Contact & support</Link><Link href="/">Home</Link></nav></footer>
  </div>;
}
