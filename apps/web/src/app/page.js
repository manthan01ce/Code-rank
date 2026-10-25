'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import TextType from '@/components/ui/TextType';
import styles from './home.module.css';

const samples = {
  Python: 'def rank_up(practice):\n    skills = []\n    for challenge in practice:\n        skills.append(solve(challenge))\n    return skills\n\nprint("Keep building. Keep growing.")',
  'C++': '#include <iostream>\n\nint main() {\n    for (int day = 1; day <= 7; day++) {\n        std::cout << "Keep practicing!";\n    }\n    return 0;\n}',
  Java: 'class CodeRank {\n    public static void main(String[] args) {\n        String goal = "Learn by doing";\n        System.out.println(goal);\n    }\n}',
  C: '#include <stdio.h>\n\nint main(void) {\n    printf("One challenge at a time.\\n");\n    return 0;\n}',
};
const roles = {
  student: { label: 'For students', title: 'Less setup. More breakthroughs.', text: 'Your next practical, your editor, and your progress. Find everything you need to turn what you know into what you can build.', items: ['Practice in C, C++, Java, and Python', 'Run code and learn from test results', 'Track submissions and practical grades'], action: 'Open student workspace', number: '01', word: 'Practice', detail: 'Write. Run. Understand. Repeat.' },
  faculty: { label: 'For faculty', title: 'Teach the concept. See the progress.', text: 'Bring your practicals together in one place. Set challenges, follow submissions, and spend more time helping students understand their code.', items: ['Create and organize coding practicals', 'Follow student submissions and scores', 'Review grades and generate reports'], action: 'Open faculty workspace', number: '02', word: 'Guide', detail: 'Better visibility. Meaningful feedback.' },
  admin: { label: 'For administrators', title: 'A connected lab starts here.', text: 'Give your department a shared foundation for practical learning, with organized courses, people, and access.', items: ['Manage students and faculty', 'Organize departments and courses', 'Review activity through audit logs'], action: 'Open admin workspace', number: '03', word: 'Connect', detail: 'One department. One shared workspace.' },
};

function subscribeToSession(callback) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}
function readSession() {
  try { return localStorage.getItem('token') ? localStorage.getItem('user') : null; }
  catch { return null; }
}

export default function HomePage() {
  const savedSession = useSyncExternalStore(subscribeToSession, readSession, () => null);
  let user = null;
  try {
    const parsed = JSON.parse(savedSession);
    if (parsed && Object.hasOwn(roles, parsed.role)) user = parsed;
  } catch { /* Invalid sessions fall back to sign in. */ }
  const [language, setLanguage] = useState('Python');
  const [role, setRole] = useState('student');
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs = useRef([]);
  const dashboard = user?.role === 'admin' ? '/admin' : user?.role === 'faculty' ? '/faculty' : '/student';
  const current = roles[role];
  function changeTab(event, index) {
    const keys = Object.keys(roles);
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % keys.length;
    if (event.key === 'ArrowLeft') next = (index + keys.length - 1) % keys.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = keys.length - 1;
    if (next !== undefined) { event.preventDefault(); setRole(keys[next]); tabs.current[next]?.focus(); }
  }
  return (
    <div className={styles.home}>
      <a className={styles.skip} href="#main">Skip to content</a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="CodeRank home"><Image src="/coderank-logo.jpg" alt="" width={36} height={36} /><span>Code<span>Rank</span><small>THE CODING LAB, REIMAGINED</small></span></Link>
        <button className={styles.menuButton} aria-expanded={menuOpen} aria-controls="home-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close' : 'Menu'} <span aria-hidden="true">☰</span></button>
        <nav id="home-navigation" aria-label="Main navigation" className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`} onClick={() => setMenuOpen(false)}>
          <a href="#experience">The experience</a><a href="#roles">Built for you</a><Link href="/practice">Practice sandbox ↗</Link>
        </nav>
        <Link className={styles.headerAction} href={user ? dashboard : '/login'}>{user ? 'My workspace' : 'Sign in'} <span aria-hidden="true">↗</span></Link>
      </header>
      <main id="main">
        <section className={styles.hero}>
        <div className={styles.originalHero}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            padding: '5px 14px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#1d4ed8',
            marginBottom: '20px'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'inline-block' }}></span>
            Real-Time Automated Practical Assessment Platform
          </div>

          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 44px)',
            fontWeight: 800,
            lineHeight: 1.15,
            color: '#0f172a',
            letterSpacing: '-1px',
            marginBottom: '18px'
          }}>
            <TextType text={["RANK UP CODING"]} typingSpeed={75} pauseDuration={1500} deletingSpeed={50} cursorColor="currentColor" prefixColor="currentColor" />
          </h1>

          <p style={{
            fontSize: '17px',
            lineHeight: 1.6,
            color: '#475569',
            marginBottom: '32px',
            maxWidth: '560px'
          }}>
            Streamlined for university computer science departments. Conduct automated practicals in C, C++, Java, and Python with live socket streaming, instant batch grading, anti-plagiarism guards, and faculty controls.
          </p>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <Link
              href="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '13px 26px',
                backgroundColor: '#4F46E5',
                color: '#ffffff',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                transition: 'transform 0.15s, background 0.2s'
              }}
            >
              Get Started with CodeRank &rarr;
            </Link>

            <Link
              href="/practice"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '13px 22px',
                backgroundColor: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
              }}
            >
              Try Practice Sandbox
            </Link>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'flex', gap: '28px', marginTop: '40px', paddingTop: '28px', borderTop: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>4+</div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Languages Supported</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>&lt; 35ms</div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Execution Latency</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>100%</div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Automated Verification</div>
            </div>
          </div>
        </div>

          <div className={styles.studio}>
            <div className={styles.orbit} aria-hidden="true" />
            <div className={styles.floatingLabel}><span aria-hidden="true">✧</span> Your next “I got it!” starts here.</div>
            <div className={styles.editor}>
              <div className={styles.editorTop}><span className={styles.editorMark} aria-hidden="true">{'{ }'}</span><span>THE PRACTICE STUDIO</span><span className={styles.previewBadge}>PREVIEW</span></div>
              <div className={styles.languageTabs} aria-label="Preview language">{Object.keys(samples).map(item => <button key={item} aria-pressed={language === item} onClick={() => setLanguage(item)} className={language === item ? styles.selectedLanguage : ''}>{item}</button>)}</div>
              <div className={styles.code} key={language}>{samples[language].split('\n').map((line, i) => <div key={i}><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><code>{line || ' '}</code></div>)}</div>
              <div className={styles.editorBottom}><span><span className={styles.dot} /> Make room for a little progress.</span><Link href="/practice" aria-label={`Open practice sandbox to write ${language} code`}>Start coding ↗</Link></div>
            </div>
            <div className={styles.progressCard}><span className={styles.progressIcon} aria-hidden="true">↗</span><div><strong>Every attempt counts.</strong><p>Build confidence, one solution at a time.</p></div><span className={styles.miniBars} aria-hidden="true"><i /><i /><i /><i /><i /></span></div>
          </div>
        </section>
        <div className={styles.languageStrip}><span>FOUR LANGUAGES. ENDLESS POSSIBILITIES.</span><div>{['C', 'C++', 'Java', 'Python'].map((item, i) => <span key={item}><small aria-hidden="true">0{i + 1}</small>{item}</span>)}</div></div>
        <section id="experience" className={styles.experience}>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>FROM FIRST LINE TO FINISHED PRACTICAL</p><h2>A little less friction.<br />A lot more <em>forward.</em></h2></div><p>Everything a coding lab needs to keep learning moving. All in one thoughtful workspace.</p></div>
          <div className={styles.featureGrid}>
            <article className={styles.feature}><div className={styles.featureTop}><span aria-hidden="true">{'</>'}</span><small>01 / EXPLORE</small></div><h3>Think it. Code it.<br />Try it again.</h3><p>A browser-based coding sandbox for exploring ideas in four core programming languages.</p><Link href="/practice">Find your flow <span aria-hidden="true">↗</span></Link><div className={styles.codeDecoration} aria-hidden="true"><span>idea</span><b>→</b><span>code</span><b>→</b><span>discovery</span></div></article>
            <article className={`${styles.feature} ${styles.featureTint}`}><div className={styles.featureTop}><span aria-hidden="true">✓</span><small>02 / ASSESS</small></div><h3>Less waiting.<br />More understanding.</h3><p>Run practicals with test-based grading and submission tracking, so feedback becomes part of learning.</p><div className={styles.testPreview} aria-label="Illustrative assessment workflow"><div><span>Write a solution</span><b>01</b></div><div><span>Run your test cases</span><b>02</b></div><div><span>Learn from the result</span><b>03</b></div></div></article>
            <article className={styles.feature}><div className={styles.featureTop}><span aria-hidden="true">↗</span><small>03 / GROW</small></div><h3>See the bigger<br />learning picture.</h3><p>Connected student, faculty, and administrator portals bring courses, assessments, and progress together.</p><a href="#roles">Meet your workspace <span aria-hidden="true">↗</span></a><div className={styles.growth} aria-hidden="true">{[25, 42, 38, 65, 76, 100].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}<span>PROGRESS IS A PRACTICE.</span></div></article>
          </div>
        </section>
        <section id="roles" className={styles.roles}>
          <div className={styles.roleIntro}><p className={styles.eyebrow}>DIFFERENT ROLES. SHARED AMBITION.</p><h2>Your place in<br />the <em>possibility.</em></h2><div className={styles.roleTabs} role="tablist" aria-label="Explore workspaces">{Object.entries(roles).map(([key, item], i) => <button ref={el => { tabs.current[i] = el; }} key={key} id={`tab-${key}`} role="tab" aria-selected={role === key} aria-controls="role-panel" tabIndex={role === key ? 0 : -1} onKeyDown={event => changeTab(event, i)} onClick={() => setRole(key)}>{item.label}<span aria-hidden="true">↗</span></button>)}</div></div>
          <div id="role-panel" role="tabpanel" aria-labelledby={`tab-${role}`} tabIndex={0} className={styles.rolePanel}><div key={role} className={styles.roleContent}><div className={styles.roleVisual} aria-hidden="true"><span>{current.number}</span><strong>{current.word}<i>↗</i></strong><small>{current.detail}</small></div><h3>{current.title}</h3><p>{current.text}</p><ul>{current.items.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul><Link href={user?.role === role ? dashboard : '/login'}>{current.action} <span aria-hidden="true">↗</span></Link></div></div>
        </section>
        <section className={styles.finalCta}><p className={styles.eyebrow}>YOUR NEXT CHAPTER STARTS WITH A LINE OF CODE.</p><h2>Ready to find your<br /><em>next breakthrough?</em></h2><div className={styles.actions}><Link className={styles.primary} href={user ? dashboard : '/login'}>Let’s get coding <span aria-hidden="true">↗</span></Link><Link className={styles.secondary} href="/practice">Explore the sandbox ↗</Link></div><span className={styles.ctaBracket} aria-hidden="true">{'{ }'}</span></section>
      </main>
      <footer className={styles.footer}><Link href="/" className={styles.footerBrand}>Code<span>Rank</span></Link><p>Practice with purpose. Progress with confidence.</p><span>© {new Date().getFullYear()} CodeRank</span><a href="#main">Back to top ↑</a></footer>
    </div>
  );
}
