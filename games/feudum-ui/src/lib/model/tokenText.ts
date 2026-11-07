import {
    GuildIds,
    Goods,
    type BeadValue,
    type Good,
    type GuildId,
    type MonsterId,
    type VesselType
} from '@tabletop/feudum'
import type { ShillingValue } from '$lib/art/assetMap.js'

export type TextToken =
    | { readonly kind: 'good'; readonly good: Good }
    | { readonly kind: 'shilling'; readonly value: ShillingValue }
    | { readonly kind: 'seal' }
    | { readonly kind: 'bead'; readonly value?: BeadValue }
    | { readonly kind: 'vp' }
    | { readonly kind: 'vessel'; readonly vessel: VesselType }
    | { readonly kind: 'monster'; readonly monster: MonsterId }
    | { readonly kind: 'guild'; readonly guild: GuildId }
    | { readonly kind: 'star' }

export type TokenPart =
    | { readonly text: string }
    | { readonly token: TextToken; readonly word: string; readonly amount?: string }

const Pattern =
    /\b(?:(\d+)\s?s\b|(\d+)\s?vp\b|(saltpeter|sulfur|iron|wood|food)\b|(seal)s?\b|(bead)s?\b|(ship|submersible|flying machine)s?\b|(behemoth|sea serpent)\b|(farmer|merchant|alchemist|knight|noble|monk)s?\b)|(★)/gi

function vesselOf(word: string): VesselType {
    return word === 'flying machine' ? 'flying-machine' : word === 'ship' ? 'ship' : 'submersible'
}

/**
 * Splits a panel or history line so a good, shilling, seal, bead, vp, vessel or monster it names
 * is drawn as its piece, the word kept as the image's alt text. One vocabulary for table and text.
 */
export function tokenParts(text: string): TokenPart[] {
    const parts: TokenPart[] = []
    let at = 0
    for (const match of text.matchAll(Pattern)) {
        if (match.index > at) {
            parts.push({ text: text.slice(at, match.index) })
        }
        const [word, shillings, vp, good, seal, bead, vessel, monster, guild, star] = match
        const lower = (found: string) => found.toLowerCase()
        if (shillings) {
            parts.push({ token: { kind: 'shilling', value: 1 }, word, amount: shillings })
        } else if (vp) {
            parts.push({ token: { kind: 'vp' }, word, amount: vp })
        } else if (good) {
            const named = Goods.find((one) => one === lower(good))
            if (named) {
                parts.push({ token: { kind: 'good', good: named }, word })
            }
        } else if (seal) {
            parts.push({ token: { kind: 'seal' }, word })
        } else if (bead) {
            parts.push({ token: { kind: 'bead' }, word })
        } else if (vessel) {
            parts.push({ token: { kind: 'vessel', vessel: vesselOf(lower(vessel)) }, word })
        } else if (monster) {
            const id: MonsterId = lower(monster) === 'behemoth' ? 'behemoth' : 'sea-serpent'
            parts.push({ token: { kind: 'monster', monster: id }, word })
        } else if (guild) {
            const named = GuildIds.find((one) => lower(guild).startsWith(one))
            if (named) {
                parts.push({ token: { kind: 'guild', guild: named }, word })
            }
        } else if (star) {
            parts.push({ token: { kind: 'star' }, word })
        }
        at = match.index + word.length
    }
    if (at < text.length) {
        parts.push({ text: text.slice(at) })
    }
    return parts
}
