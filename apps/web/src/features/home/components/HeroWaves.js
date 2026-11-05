'use client';

import { useEffect, useRef } from 'react';
import styles from './home.module.css';

// Original SVG ribbon implementation inspired by flowing-line backgrounds:
// https://reactbits.dev/backgrounds/waves (no third-party source copied).
const lines = Array.from({ length: 32 }, (_, i) => i);
const particles = Array.from({ length: 18 }, (_, i) => ({
  x: 24 + (i * 137) % 580,
  y: 60 + (i * 83) % 480,
  radius: i % 4 === 0 ? 3 : 1.4,
}));

export default function HeroWaves() {
  const artwork = useRef(null);

  useEffect(() => {
    const element = artwork.current;
    let visible = true;
    const update = () => {
      element.dataset.paused = String(!visible || document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return (
    <div ref={artwork} className={styles.heroWaves} aria-hidden="true">
      <svg viewBox="0 0 640 600" fill="none" preserveAspectRatio="none" focusable="false">
        <g className={styles.waveRibbon} stroke="currentColor" strokeWidth=".7" opacity=".16">
          {lines.map(i => <path key={i} d={`M -80 ${390 + i * 3} C 80 ${590 - i * 2}, 145 ${430 - i * 5}, 285 ${235 + i * 2} S 475 ${145 + i * 7}, 720 ${100 + i * 3}`} />)}
        </g>
        <g className={styles.waveRibbonSecondary} stroke="currentColor" strokeWidth=".65" opacity=".13">
          {lines.map(i => <path key={i} d={`M -60 ${490 + i * 2} C 100 ${310 + i * 5}, 200 ${555 - i * 4}, 360 ${360 + i * 2} S 540 ${220 - i * 3}, 710 ${280 + i * 4}`} />)}
        </g>
        <g className={styles.waveParticles} fill="currentColor">
          {particles.map((point, i) => <circle key={i} cx={point.x} cy={point.y} r={point.radius} opacity={i % 3 === 0 ? '.5' : '.25'} />)}
          <rect x="520" y="95" width="24" height="36" rx="6" opacity=".12" />
          <rect x="38" y="370" width="16" height="20" rx="4" opacity=".15" />
          <circle cx="34" cy="315" r="7" stroke="currentColor" strokeWidth="3" fill="white" opacity=".45" />
        </g>
      </svg>
    </div>
  );
}
