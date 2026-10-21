import { HydratedOathGameState } from '../model/gameState.js'
import { cardDefinition } from '../data/cardRegistry.js'
import { persistentsInPlay, type ScopedParties } from './persistent.js'
import { siteHolding } from './access.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'

/** R-7.2.2 — the printed lock, or one a persistent power imposes on this actor. */
export function isLockedFor(
    state: HydratedOathGameState,
    actorId: string,
    cardId: string
): boolean {
    if (cardDefinition(cardId)?.locked) return true
    const siteId = siteHolding(state, cardId)
    return siteId !== undefined && siteLockedFor(state, actorId, siteId)
}

export function siteLockedFor(
    state: HydratedOathGameState,
    actorId: string,
    siteId: string,
    parties?: ScopedParties
): boolean {
    for (const { ctx, hooks } of persistentsInPlay(state, parties)) {
        if (hooks.locksSiteFor?.(ctx, actorId, siteId)) return true
    }
    return false
}

/**
 * R-7.2.2 — a power that moves its own card checks that card's lock as it checks its target's (Great Herd's Q&A: "A
 * locked card cannot be discarded, moved or swapped"; Ancient Bloodline's: "stuck at the site, except for
 * Bloodline's ruler"). `siteId` is where the card is, or, for a card about to be played, where it is played to.
 * Before revision 16 (R-X.4), never.
 */
export function ownCardLockedFor(
    state: HydratedOathGameState,
    actorId: string,
    cardId: string,
    siteId: string | undefined = siteHolding(state, cardId)
): boolean {
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes12)) return false
    if (cardDefinition(cardId)?.locked) return true
    return siteId !== undefined && siteLockedFor(state, actorId, siteId)
}

/** R-7.2.1, R-7.2.2 — a faceup card moved or swapped goes only where its banners allow. */
export function reasonCannotMoveCardTo(
    state: HydratedOathGameState,
    actorId: string,
    cardId: string,
    to: 'site' | 'advisers'
): string | undefined {
    if (isLockedFor(state, actorId, cardId)) return `${cardId} is locked`
    const placement = cardDefinition(cardId)?.placement
    if (to === 'site' && placement === 'adviser') return `${cardId} can only be an adviser`
    if (to === 'advisers' && placement === 'site') return `${cardId} can only be at a site`
    return undefined
}
