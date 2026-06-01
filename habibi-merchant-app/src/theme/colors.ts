// Habibi Halal Express — Merchant Console
// Dark + gold theme matching the website and admin panel exactly.
// Primary gold: #E5B64E  |  Red accent: #dc2626

export const Colors = {
  // ── Backgrounds — deep dark matching website navbar + admin ──────────
  bg:        '#0b0d14',   // same as admin --color-bg
  surface:   '#111827',   // same as admin --color-surface
  surface2:  '#1a2035',   // same as admin --color-surface-2
  surfaceHover: '#1f2844',

  // ── Borders ──────────────────────────────────────────────────────────
  border:    'rgba(255, 255, 255, 0.08)',
  border2:   'rgba(255, 255, 255, 0.14)',

  // ── Brand Gold — primary accent (matches website gold) ───────────────
  primary:     '#E5B64E',
  primaryDim:  'rgba(229, 182, 78, 0.12)',
  primaryHover:'#ffd700',
  gold:        '#E5B64E',
  goldDim:     'rgba(229, 182, 78, 0.12)',
  goldBorder:  'rgba(229, 182, 78, 0.28)',
  goldHover:   'rgba(229, 182, 78, 0.18)',

  // ── Red accent (matches website --color-secondary) ───────────────────
  red:       '#dc2626',
  redDim:    'rgba(220, 38, 38, 0.12)',
  redBorder: 'rgba(220, 38, 38, 0.25)',

  // ── White (for text/icons on colored backgrounds) ─────────────────────
  white: '#ffffff',

  // ── Text ─────────────────────────────────────────────────────────────
  text:      '#f1f5f9',   // light text on dark bg
  textSub:   '#94a3b8',
  textMuted: '#64748b',
  textDim:   '#475569',

  // ── Semantic ─────────────────────────────────────────────────────────
  success:    '#22c55e',
  successDim: 'rgba(34, 197, 94, 0.12)',
  error:      '#ef4444',
  errorDim:   'rgba(239, 68, 68, 0.12)',
  warning:    '#f59e0b',
  warningDim: 'rgba(245, 158, 11, 0.12)',
  info:       '#3b82f6',
  infoDim:    'rgba(59, 130, 246, 0.12)',

  // ── Order status ─────────────────────────────────────────────────────
  pending:   '#E5B64E',   // gold — warm "waiting" signal
  preparing: '#3b82f6',   // blue
  ready:     '#22c55e',   // green
  delivered: '#64748b',   // muted
  cancelled: '#ef4444',   // red
};

export const StatusColor: Record<string, string> = {
  pending:          Colors.pending,
  accepted:         Colors.info,
  confirmed:        Colors.info,
  preparing:        Colors.preparing,
  cooking:          Colors.preparing,
  ready:            Colors.ready,
  out_for_delivery: Colors.info,
  delivered:        Colors.delivered,
  completed:        Colors.delivered,
  cancelled:        Colors.cancelled,
};
