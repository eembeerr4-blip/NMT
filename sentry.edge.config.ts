import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, sentryEnabled, sentryEnvironment } from "@/lib/monitoring/sentry";

if (sentryEnabled()) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: sentryEnvironment(),
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
}
