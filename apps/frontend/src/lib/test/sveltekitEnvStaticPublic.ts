// Stand-in for SvelteKit's generated `$env/static/public` in client-mode Vitest runs, which don't
// load the SvelteKit plugin. Specs that care about these values override them with vi.mock.
export const PUBLIC_API_HOST = ''
export const PUBLIC_SSE_HOST = ''
export const PUBLIC_ENABLE_ABLY_REALTIME = ''
export const PUBLIC_ENABLE_DISCORD_LOGIN = ''
export const PUBLIC_GOOGLE_CLIENT_ID = ''
export const PUBLIC_VAPID_KEY = ''
