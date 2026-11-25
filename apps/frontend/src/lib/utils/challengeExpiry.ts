import { m } from '$lib/paraglide/messages'
import { getLocale } from '$lib/paraglide/runtime'

export function challengeExpiryText(expiresAt: Date): string {
    const time = expiresAt.toLocaleTimeString(getLocale(), { hour: 'numeric', minute: '2-digit' })
    return m.auth_challenge_expiry({ time })
}
