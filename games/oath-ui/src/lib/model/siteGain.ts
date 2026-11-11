import type { SitePlayGain } from '@tabletop/oath'
import { plural } from './names.js'

/** One part of the line on "To your site": a count and its token, gold while it gains something. */
export type SiteGainPart = { text: string; gains: boolean }

/**
 * R-5.1.4.I, R-11.2, R-7.4 — the line after "To your site": "+2 favor", "+1 secret" (Book of Records, a secret
 * Homeland) beside any favor, or "+0 favor" when the play gains nothing.
 */
export function siteGainParts(gain: SitePlayGain): SiteGainPart[] {
    const secrets = gain.secrets > 0 ? [`+${plural(gain.secrets, 'secret')}`] : []
    const favor = gain.favor > 0 ? [`+${gain.favor} favor`] : []
    const parts = [...secrets, ...favor].map((text) => ({ text, gains: true }))
    return parts.length > 0 ? parts : [{ text: '+0 favor', gains: false }]
}

/** The line as the button's name reads it: "To your site, +2 favor". */
export function withSiteGain(label: string, gain: SitePlayGain | undefined): string {
    if (!gain) return label
    return `${label}, ${siteGainParts(gain)
        .map((part) => part.text)
        .join(' ')}`
}
