const isProd = process.env.NODE_ENV === 'production';

// In production the client only ever sees a generic message — but that means
// the real error must be logged here, or a 500 is completely invisible in
// pm2 logs (this silence is exactly what let a wrong-column-name bug in
// paymentMethodController sit undetected until a user reported it).
module.exports = function safeError(err) {
  if (isProd) console.error('[API Error]', err?.message, err?.stack);
  return { error: isProd ? 'Internal server error.' : err.message };
};
