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
const featureJourney = [
  { name: 'Practice', title: 'Give your ideas somewhere to go.', description: 'Explore C, C++, Java, and Python in a browser-based coding workspace. Work through a problem, try your approach, and refine it.', label: 'A place to experiment', detail: 'Understand the problem → Write your approach → Run your code', action: 'Enter your workspace', icon: '{ }' },
  { name: 'Assess', title: 'Make feedback part of the process.', description: 'Complete faculty-assigned practicals with test-based grading and submission tracking. Use the results to understand what to try next.', label: 'A clearer next step', detail: 'Assigned practical → Your solution → Test feedback', action: 'View your practicals', icon: '✓' },
  { name: 'Connect', title: 'One lab. A shared direction.', description: 'Student, faculty, and administrator workspaces keep courses, assessments, and progress connected across your institution.', label: 'Everyone has a place', detail: 'Students practice · Faculty guide · Administrators organize', action: 'Find your workspace', icon: '↗' },
];

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
  const [feature, setFeature] = useState(0);
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
        <Link href="/" className={styles.brand} aria-label="CodeRank home"><Image src="/coderank-logo.jpg" alt="" width={36} height={36} /><span>Code<span>Rank</span></span></Link>
        <button className={styles.menuButton} aria-expanded={menuOpen} aria-controls="home-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close' : 'Menu'} <span aria-hidden="true">☰</span></button>
        <nav id="home-navigation" aria-label="Main navigation" className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`} onClick={() => setMenuOpen(false)}>
          <a href="#experience">The experience</a><a href="#roles">Built for you</a>
        </nav>
        <Link className={styles.headerAction} href={user ? dashboard : '/login'}>{user ? 'My workspace' : 'Sign in'} <span aria-hidden="true">↗</span></Link>
      </header>
      <main id="main">
        <section className={styles.hero}>
        <div className={styles.originalHero}>
          <p className={styles.heroBrand}>Code<span>Rank</span></p>

          <p className={styles.heroEyebrow}><span /> THE UNIVERSITY CODING WORKSPACE</p>
          <h1 className={styles.heroTitle}>
            <TextType text={["RANK UP CODING"]} typingSpeed={75} pauseDuration={1500} deletingSpeed={50} cursorColor="currentColor" prefixColor="currentColor" />
          </h1>
          <p className={styles.heroDescription}>
            Streamlined for university computer science departments. Conduct automated practicals in C, C++, Java, and Python with live socket streaming, instant batch grading, anti-plagiarism guards, and faculty controls.
          </p>
          <div className={styles.heroActions}>
            <Link href={user ? dashboard : '/login'} className={styles.primary}>Get Started with CodeRank <span aria-hidden="true">↗</span></Link>
            <a href="#experience" className={styles.heroExplore}>Explore the platform <span aria-hidden="true">↓</span></a>
          </div>
          <div className={styles.heroFootnote}><span aria-hidden="true">{'</>'}</span> Built for your next breakthrough.</div>


        </div>

          <div className={styles.studio}>
            <div className={styles.studioHeading}><span>IDEAS INTO IMPACT</span><span>CODE / LEARN / REPEAT</span></div>
            <div className={styles.orbit} aria-hidden="true"><div className={styles.orbitCore}><Image src="/coderank-logo.jpg" alt="" width={82} height={82} /></div><span className={styles.orbitSatellite}>{'{ }'}</span></div>
            <div className={styles.editor}>
              <div className={styles.editorTop}><span className={styles.editorMark} aria-hidden="true">{'{ }'}</span><span className={styles.editorFilename}>{language === 'Python' ? 'practice.py' : language === 'Java' ? 'CodeRank.java' : language === 'C++' ? 'practice.cpp' : 'practice.c'}</span><span className={styles.previewBadge}>CODE PREVIEW</span></div>
              <div className={styles.languageTabs} aria-label="Preview language">{Object.keys(samples).map(item => <button key={item} aria-pressed={language === item} onClick={() => setLanguage(item)} className={language === item ? styles.selectedLanguage : ''}>{item}</button>)}</div>
              <div className={styles.code} key={language}>{samples[language].split('\n').map((line, i) => <div key={i}><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><code>{line || ' '}</code></div>)}</div>

            </div>
            <div className={styles.progressCard}><span className={styles.progressIcon} aria-hidden="true">↗</span><div><strong>Every attempt counts.</strong><p>Build confidence, one solution at a time.</p></div><span className={styles.miniBars} aria-hidden="true"><i /><i /><i /><i /><i /></span></div>
          </div>
        </section>
        <div className={styles.languageStrip}><span>FOUR LANGUAGES. ENDLESS POSSIBILITIES.</span><div>{['C', 'C++', 'Java', 'Python'].map((item, i) => <span key={item}><small aria-hidden="true">0{i + 1}</small>{item}</span>)}</div></div>
        <section id="experience" className={styles.experience}>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>FROM FIRST LINE TO FINISHED PRACTICAL</p><h2>A little less friction.<br />A lot more <em>forward.</em></h2></div><p>Everything a coding lab needs to keep learning moving. All in one thoughtful workspace.</p></div>
          <div className={styles.learningPath}>
            <div className={styles.pathNavigation} role="group" aria-label="Explore platform features">{featureJourney.map((item, index) => <button key={item.name} aria-pressed={feature === index} aria-controls="feature-detail" onClick={() => setFeature(index)}><span className={styles.pathNumber}>0{index + 1}</span><span><strong>{item.name}</strong><small>{item.label}</small></span><span aria-hidden="true">↗</span></button>)}</div>
            <div id="feature-detail" className={styles.pathDetail} aria-live="polite"><div key={feature} className={styles.pathDetailContent}><div className={styles.pathKicker}><span>THE CODERANK EXPERIENCE</span><span>0{feature + 1} / 03</span></div><div className={styles.pathSymbol} aria-hidden="true">{featureJourney[feature].icon}</div><h3>{featureJourney[feature].title}</h3><p>{featureJourney[feature].description}</p><div className={styles.pathFlow}>{featureJourney[feature].detail}</div><Link href={user ? dashboard : '/login'}>{featureJourney[feature].action} <span aria-hidden="true">↗</span></Link></div></div>
          </div>
        </section>
        <section id="roles" className={styles.roles}>
          <div className={styles.roleIntro}><p className={styles.eyebrow}>DIFFERENT ROLES. SHARED AMBITION.</p><h2>Your place in<br />the <em>possibility.</em></h2><div className={styles.roleTabs} role="tablist" aria-label="Explore workspaces">{Object.entries(roles).map(([key, item], i) => <button ref={el => { tabs.current[i] = el; }} key={key} id={`tab-${key}`} role="tab" aria-selected={role === key} aria-controls="role-panel" tabIndex={role === key ? 0 : -1} onKeyDown={event => changeTab(event, i)} onClick={() => setRole(key)}>{item.label}<span aria-hidden="true">↗</span></button>)}</div></div>
          <div id="role-panel" role="tabpanel" aria-labelledby={`tab-${role}`} tabIndex={0} className={styles.rolePanel}><div key={role} className={styles.roleContent}><div className={styles.roleVisual} aria-hidden="true"><span>{current.number}</span><strong>{current.word}<i>↗</i></strong><small>{current.detail}</small></div><h3>{current.title}</h3><p>{current.text}</p><ul>{current.items.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul><Link href={user?.role === role ? dashboard : '/login'}>{current.action} <span aria-hidden="true">↗</span></Link></div></div>
        </section>
        <section className={styles.finalCta}><p className={styles.eyebrow}>YOUR NEXT CHAPTER STARTS WITH A LINE OF CODE.</p><h2>Ready to find your<br /><em>next breakthrough?</em></h2><div className={styles.actions}><Link className={styles.primary} href={user ? dashboard : '/login'}>Let’s get coding <span aria-hidden="true">↗</span></Link></div><span className={styles.ctaBracket} aria-hidden="true">{'{ }'}</span></section>
      </main>
      <footer className={`${styles.footer} ${styles.refinedFooter}`}>
        <div className={styles.footerColumns}>
          <div className={styles.footerAbout}><Link href="/" className={styles.footerLogo}><Image src="/coderank-logo.jpg" alt="" width={36} height={36}/><span>Code<strong>Rank</strong></span></Link><p>Practice with purpose.<br/>Progress with confidence.</p><small>A connected space for university<br/>coding labs and practical learning.</small></div>
          <nav aria-label="Footer platform navigation"><h3>Explore CodeRank</h3><a href="#experience">The learning experience</a><a href="#roles">Student & faculty workspaces</a><Link href="/login">Sign in to your workspace ↗</Link></nav>
          <div className={styles.footerPurpose}><span aria-hidden="true">{'</>'}</span><h3>Learn by doing.<br/>Grow by building.</h3><p>C · C++ · Java · Python</p></div>
        </div>
        <div className={styles.footerLegal}><span>© {new Date().getFullYear()} CodeRank</span><span>Built for the university coding lab.</span><a href="#main">Back to top ↑</a></div>
      </footer>
    </div>
  );
}
