import { HydratedOathGameState } from '../model/gameState.js'
import { powersWithTiming, PowerTiming } from '../data/cardPowers.js'
import { effectFor, type ContinuousHooks } from '../powers/registry.js'
import { suitOf } from '../data/cardRegistry.js'

/** R-7.1.4-H1 — a continuous power binds its holder: faceup advisers and held relics; Master of Disguise lends another player's advisers. */
export function continuousHooksOf(
    state: HydratedOathGameState,
    playerId: string,
    advisersOf = playerId
): ContinuousHooks[] {
    const advisers = state.getPlayerState(advisersOf).faceupAdviserIds()
    const held = [...advisers, ...state.getPlayerState(playerId).relicIds]
    return held.flatMap((cardId) => hooksOfCard(state, cardId))
}

/** R-7.6.4 — `withCardId` counts a card about to be played faceup. */
export function effectiveAdviserLimit(
    state: HydratedOathGameState,
    playerId: string,
    withCardId?: string
): number {
    const player = state.getPlayerState(playerId)
    let limit = player.adviserLimit
    for (const hooks of continuousHooksOf(state, playerId)) {
        if (hooks.adviserLimit !== undefined) limit = Math.min(limit, hooks.adviserLimit)
    }
    if (withCardId) {
        for (const hooks of hooksOfCard(state, withCardId)) {
            if (hooks.adviserLimit !== undefined) limit = Math.min(limit, hooks.adviserLimit)
        }
    }
    return limit
}

/** Vow of Poverty — "You cannot gain favor from Trade." */
export function cannotGainFavorFromTrade(
    state: HydratedOathGameState,
    playerId: string,
    advisersOf = playerId
): boolean {
    return continuousHooksOf(state, playerId, advisersOf).some((h) => h.cannotGainFavorFromTrade)
}

/** Ring of Devotion — "You cannot place warbands at sites." */
export function cannotPlaceWarbandsAtSites(
    state: HydratedOathGameState,
    playerId: string
): boolean {
    return continuousHooksOf(state, playerId).some((h) => h.cannotPlaceWarbandsAtSites)
}

/** Ring of Devotion — "When mustering, you gain two more warbands." */
export function musterWarbandsBonus(state: HydratedOathGameState, playerId: string): number {
    return continuousHooksOf(state, playerId).reduce((n, h) => n + (h.musterWarbandsBonus ?? 0), 0)
}

/** Vow of Obedience — "You cannot play Visions faceup." */
export function cannotPlayVisionsFaceup(state: HydratedOathGameState, playerId: string): boolean {
    return continuousHooksOf(state, playerId).some((h) => h.cannotPlayVisionsFaceup)
}

function hooksOfCard(state: HydratedOathGameState, cardId: string): ContinuousHooks[] {
    const hooks: ContinuousHooks[] = []
    for (const power of powersWithTiming(cardId, PowerTiming.Continuous)) {
        const c = effectFor(power)?.continuous
        if (c) hooks.push(c)
    }
    return hooks
}

/** R-7.6.4 — a facedown card always counts; a faceup one is exempt by its own or a held card's text. */
export function countsTowardAdviserLimit(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    faceUp: boolean,
    withCardId?: string
): boolean {
    if (!faceUp) return true
    if (hooksOfCard(state, cardId).some((h) => h.ignoresAdviserLimit)) return false
    const held = [
        ...continuousHooksOf(state, playerId),
        ...(withCardId ? hooksOfCard(state, withCardId) : [])
    ]
    const suit = suitOf(cardId)
    return !held.some(
        (h) => h.adviserLimitExemptSuit !== undefined && h.adviserLimitExemptSuit === suit
    )
}

export function advisersTowardLimit(
    state: HydratedOathGameState,
    playerId: string,
    withCardId?: string
): number {
    const player = state.getPlayerState(playerId)
    const facedown = player.advisers.filter((row) => !row.faceUp).length
    const faceup = player
        .faceupAdviserIds()
        .filter((cardId) => countsTowardAdviserLimit(state, playerId, cardId, true, withCardId))
    return facedown + faceup.length
}
