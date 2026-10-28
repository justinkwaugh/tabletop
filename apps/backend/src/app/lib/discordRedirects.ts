import type { OAuthPurpose } from '@tabletop/backend-services'

const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''

// Both paths are registered with the Discord application; signed-in purposes share one.
export function discordRedirectUri(purpose: OAuthPurpose): string {
    return purpose === 'login'
        ? `${FRONTEND_HOST}/oauth/discord`
        : `${FRONTEND_HOST}/oauth/discord/link`
}
