import React from 'react';
import { Link } from 'react-router-dom';

// A footer nav link whose label lifts away on hover, letter by letter, while
// an identical gold copy rises in to take its place -- inspired by a hover
// effect Ahad pointed to (landonorris.com's nav links), rebuilt from scratch
// for Habibi's own footer with our own labels, color and timing rather than
// any borrowed code (2026-09-27).
//
// Structure: a clipped one-line window holding two stacked copies of the same
// text, the second sitting one line-height below the first. On hover both
// slide up by one line-height together, so the first copy exits the top while
// the second enters from the bottom already in its new (gold) color -- a
// classic accessible "roll" pattern, not a copy of any specific site's markup.
//
// Split per-character rather than left whole so the letters cascade in with a
// slight stagger instead of moving as one flat block, which is what makes it
// read as a lift rather than a slide. The real text stays as one plain node
// for screen readers/selection; both animated copies are aria-hidden.
const MAX_STAGGER_CHARS = 14; // longer labels stop gaining delay past this many letters
const STAGGER_STEP_MS = 14;

function Chars({ text }) {
  return [...text].map((ch, i) => (
    <span key={i} style={{ transitionDelay: `${Math.min(i, MAX_STAGGER_CHARS) * STAGGER_STEP_MS}ms` }}>
      {ch === ' ' ? ' ' : ch}
    </span>
  ));
}

export default function RollLink({ to, children, className = '', ...rest }) {
  const text = typeof children === 'string' ? children : String(children ?? '');
  return (
    <Link to={to} className={`roll-link ${className}`.trim()} {...rest}>
      <span className="roll-link-sr">{text}</span>
      <span className="roll-link-window" aria-hidden="true">
        <span className="roll-link-row roll-link-row--out"><Chars text={text} /></span>
        <span className="roll-link-row roll-link-row--in"><Chars text={text} /></span>
      </span>
    </Link>
  );
}
