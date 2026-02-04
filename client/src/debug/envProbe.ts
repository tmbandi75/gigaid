export function logClientEnv() {
  console.log('[CLIENT ENV PROBE]', {
    VITE_STRIPE_ENABLED: import.meta.env.VITE_STRIPE_ENABLED,
    ENV_KEYS: Object.keys(import.meta.env)
  })
}
