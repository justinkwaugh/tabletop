import { HydratedOathGameState } from '../model/gameState.js'
import { cardDefinition } from '../data/cardRegistry.js'
import { persistentsInPlay } from './persistent.js'
import { siteHolding } from './access.js'

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
    siteId: string
): boolean {
    for (const { ctx, hooks } of persistentsInPlay(state)) {
        if (hooks.locksSiteFor?.(ctx, actorId, siteId)) return true
    }
    return false
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
