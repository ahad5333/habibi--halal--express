// Habibi Halal Express — Merchant Console
// Brand palette aligned with the website (habibihe.com) and admin panel.
// Primary navy: #1e3a8a  |  Brand gold accent: #E5B64E

export const Colors = {
  // ── Backgrounds (light theme matching web app / admin panel) ─────────
  bg:        '#f1f5f9',   // page background (admin --color-bg)
  surface:   '#ffffff',   // card / panel surface
  surface2:  '#f8fafc',   // elevated surface
  border:    '#e2e8f0',   // subtle divider
  border2:   '#cbd5e1',   // stronger divider

  // ── Navy Blue Primary (website --color-primary) ───────────────────────
  primary:     '#1e3a8a',
  primaryHover:'#1e40af',
  primaryDim:  'rgba(30,58,138,0.08)',

  // ── Pure white — use for text/icons on primary-colored backgrounds ────
  white: '#ffffff',

  // ── Brand Gold (accent / decorative only) ────────────────────────────
  gold:       '#E5B64E',
  goldDim:    'rgba(229,182,78,0.10)',
  goldBorder: 'rgba(229,182,78,0.25)',
  goldHover:  'rgba(229,182,78,0.18)',

  // ── Text ─────────────────────────────────────────────────────────────
  text:      '#0f172a',   // --color-text-main
  textSub:   '#475569',   // medium emphasis
  textMuted: '#64748b',   // --color-text-muted
  textDim:   '#94a3b8',   // --color-text-dim (lowest emphasis)

  // ── Semantic ─────────────────────────────────────────────────────────
  success:    '#22c55e',
  successDim: 'rgba(34,197,94,0.12)',
  error:      '#ef4444',
  errorDim:   'rgba(239,68,68,0.12)',
  warning:    '#f59e0b',
  warningDim: 'rgba(245,158,11,0.12)',
  info:       '#3b82f6',
  infoDim:    'rgba(59,130,246,0.12)',

  // ── Order status ─────────────────────────────────────────────────────
  pending:   '#E5B64E',   // gold — warm "waiting" signal
  preparing: '#3b82f6',   // blue
  ready:     '#22c55e',   // green
  delivered: '#94a3b8',   // muted grey
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
