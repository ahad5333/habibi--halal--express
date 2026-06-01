const isProd = process.env.NODE_ENV === 'production';

module.exports = function safeError(err) {
  return { error: isProd ? 'Internal server error.' : err.message };
};
