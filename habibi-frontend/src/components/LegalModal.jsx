import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { DOCS } from '../data/legalDocs';
import './LegalModal.css';

export default function LegalModal({ docId, onClose }) {
  const doc = DOCS[docId];

  /* Lock body scroll while open */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!doc) return null;

  return (
    <div className="lm-backdrop" onClick={onClose}>
      <div className="lm-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={doc.label}>

        {/* Header */}
        <div className="lm-header">
          <div className="lm-header-left">
            <span className="lm-header-icon">{doc.icon}</span>
            <div>
              <p className="lm-header-eyebrow">Habibi Halal Express, Inc.</p>
              <h2 className="lm-header-title">{doc.label}</h2>
            </div>
          </div>
          <button className="lm-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="lm-body">
          <p className="lm-intro">{doc.intro}</p>

          {/* SMS quick-ref */}
          {docId === 'sms' && (
            <div className="lm-sms-banner">
              <p className="lm-sms-label">Quick Reference</p>
              <div className="lm-sms-cmds">
                {[{ cmd: 'STOP', desc: 'Opt out' }, { cmd: 'HELP', desc: 'Get support' }, { cmd: 'START', desc: 'Re-enroll' }].map(r => (
                  <div key={r.cmd} className="lm-sms-cmd">
                    <p className="lm-sms-word">{r.cmd}</p>
                    <p className="lm-sms-desc">{r.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="lm-sections">
            {doc.sections.map((s, i) => (
              <div key={i} className="lm-section">
                <div className="lm-section-hdr">
                  <span className="lm-section-icon">{s.icon}</span>
                  <h3 className="lm-section-title">{s.title}</h3>
                </div>
                {s.content && (
                  <p className="lm-section-body" style={{ whiteSpace: 'pre-line' }}>{s.content}</p>
                )}
                {s.list && (
                  <ul className="lm-list">
                    {s.list.map((item, j) => <li key={j}>{item}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <p className="lm-updated">Last updated: {doc.updated}</p>
        </div>

        {/* Footer */}
        <div className="lm-footer">
          <span className="lm-footer-note">After reading, close this window and check the box to agree.</span>
          <button className="lm-footer-btn" onClick={onClose}>Close &amp; Return</button>
        </div>

      </div>
    </div>
  );
}
