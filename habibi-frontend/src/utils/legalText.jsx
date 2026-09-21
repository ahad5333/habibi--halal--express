import React, { useMemo } from 'react';
import { DOCS } from '../data/legalDocs';
import { useSettings } from '../context/SettingsContext';

// The single way to read a legal document for display.
//
// The text lives once, in data/legalDocs.js, and is shared by the standalone
// pages (/terms, /privacy-policy, /sms-terms, /accessibility, /health-safety),
// the Legal Hub (/legal?doc=...) and the Signup consent modal. Contact details
// inside that text are written as {email} and {phone} tokens and filled here
// from CPanel settings, so the documents cannot drift from what CPanel says --
// they used to hardcode admin@habibihe.com and (718) 400-0443 in seven places,
// one of them the arbitration opt-out address, where a stale mailbox would
// quietly swallow customers' opt-out notices.
//
// Anything that renders DOCS directly will show the raw tokens, so go through
// this hook rather than importing DOCS for display.
const fill = (text, s) =>
  typeof text === 'string'
    ? text.replace(/\{email\}/g, s.email_contact).replace(/\{phone\}/g, s.phone_main)
    : text;

export function useLegalDoc(key) {
  const settings = useSettings();
  return useMemo(() => {
    const d = DOCS[key];
    if (!d) return null;
    return {
      ...d,
      subtitle: fill(d.subtitle, settings),
      intro: fill(d.intro, settings),
      sections: d.sections.map(s => ({
        ...s,
        content: fill(s.content, settings),
        list: s.list?.map(item => fill(item, settings)),
      })),
    };
  }, [key, settings]);
}

// **bold** in an intro renders as <strong>. Deliberately that one mark only --
// enough to keep "Consent is not a condition of purchase." conspicuous, without
// turning a data file into a markup language. Builds React nodes, never HTML.
export function RichText({ text }) {
  return String(text ?? '')
    .split('**')
    .map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>));
}

// For places that need plain text, e.g. a meta description.
export const plainText = text => String(text ?? '').replace(/\*\*/g, '');
