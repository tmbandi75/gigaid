import { logger } from "@/lib/logger";

export function logClientEnv() {
  logger.debug('[CLIENT ENV PROBE]', {
    VITE_STRIPE_ENABLED: import.meta.env.VITE_STRIPE_ENABLED,
    ENV_KEYS: Object.keys(import.meta.env)
  })
}
