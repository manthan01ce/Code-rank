'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { practicalDestination, practicalHasStarted } from '@/lib/practical-navigation';

function dateLabel(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
}
export default function QuestionList({ practicals, courseCode }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return <div className="student-question-list"><div className="question-list-heading" aria-hidden="true"><span>Practical</span><span>Progress</span><span>Best score</span><span>Workspace</span></div><ol>
    {practicals.map((practical, index) => {
      const solved = practical.my_status === 'Accepted';
      const attempted = Boolean(practical.my_status) && !solved;
      const started = practicalHasStarted(practical, now);
      const destination = practicalDestination(practical, courseCode);
      const expired = practical.end_time && Date.parse(practical.end_time) < now;
      const date = dateLabel(!started ? practical.start_time : practical.end_time);
      const action = solved ? 'Review' : attempted ? 'Continue' : 'Solve';
      return <li key={practical.id} className="student-question-row">
        <div className="question-main"><span className="question-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><h4>{practical.title}</h4><div className="question-metadata"><span className="question-difficulty">{practical.difficulty || 'Easy'}</span>{date && <span>{!started ? 'Opens' : expired ? 'Deadline passed' : 'Due'} <time dateTime={new Date(!started ? practical.start_time : practical.end_time).toISOString()}>{date}</time></span>}</div></div></div>
        <div className="question-progress"><span className={`question-status ${solved ? 'question-solved' : attempted ? 'question-attempted' : ''}`}><span aria-hidden="true">{solved ? '✓' : attempted ? '◐' : '○'}</span>{solved ? 'Solved' : attempted ? 'Attempted' : 'Unsolved'}</span></div>
        <div className="question-score"><span className="question-mobile-label">Best score </span>{practical.my_status && practical.my_marks !== null && practical.my_marks !== undefined ? <><strong>{practical.my_marks}</strong><span> / 10</span></> : <span aria-label="No score yet">—</span>}</div>
        <div className="question-action">{started && destination ? <Link href={destination} aria-label={`${action}: ${practical.title}`}>{action}<span aria-hidden="true">↗</span></Link> : <span className="question-locked">{started ? 'Unavailable' : 'Not started'}</span>}</div>
      </li>;
    })}
  </ol></div>;
}
