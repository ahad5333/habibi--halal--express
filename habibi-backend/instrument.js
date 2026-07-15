const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "https://d0a952c58075d97614825bafd839996d@o4511660676218880.ingest.us.sentry.io/4511660686639104",
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: 0.2,
});
