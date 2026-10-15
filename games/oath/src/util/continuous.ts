import { HydratedOathGameState } from '../model/gameState.js'
import { powersWithTiming, PowerTiming } from '../data/cardPowers.js'
import { effectFor, type ContinuousHooks } from '../powers/registry.js'
import { suitOf } from '../data/cardRegistry.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'

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
    return lowestAdviserLimit(state.getPlayerState(playerId).adviserLimit, [
        ...continuousHooksOf(state, playerId),
        ...(withCardId ? hooksOfCard(state, withCardId) : [])
    ])
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

/** Pied Piper — "This card ignores the adviser limit": played faceup, it prompts no discard (its Q&A). */
export function arrivesIgnoringAdviserLimit(state: HydratedOathGameState, cardId: string): boolean {
    return hooksOfCard(state, cardId).some((h) => h.ignoresAdviserLimit)
}

/**
 * R-7.6.4 — a facedown card always counts; a faceup one is exempt by a held card's text (Family
 * Wagon's Nomads). Pied Piper's Q&A: once held it "still counts toward your total number of
 * advisers"; before revision 11 it never counted.
 */
export function countsTowardAdviserLimit(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    faceUp: boolean,
    withCardId?: string
): boolean {
    if (!faceUp) return true
    if (
        !isAtLeastOathRevision(state, OathRevision.EngineFixes7) &&
        arrivesIgnoringAdviserLimit(state, cardId)
    ) {
        return false
    }
    const held = [
        ...continuousHooksOf(state, playerId),
        ...(withCardId ? hooksOfCard(state, withCardId) : [])
    ]
    return !exemptFromAdviserLimit(held, cardId)
}

/** Family Wagon — "they ignore your adviser limit": a suit a held card exempts. */
function exemptFromAdviserLimit(held: readonly ContinuousHooks[], cardId: string): boolean {
    const suit = suitOf(cardId)
    return held.some(
        (h) => h.adviserLimitExemptSuit !== undefined && h.adviserLimitExemptSuit === suit
    )
}

/** R-7.6.4 — a limiter: its own text sets the adviser limit or exempts a suit from it (Family Wagon). */
export function shapesAdviserLimit(state: HydratedOathGameState, cardId: string): boolean {
    return hooksOfCard(state, cardId).some(
        (h) => h.adviserLimit !== undefined || h.adviserLimitExemptSuit !== undefined
    )
}

/** R-7.6.4 — with several limiters, the limit is the lowest among them. */
function lowestAdviserLimit(base: number, held: readonly ContinuousHooks[]): number {
    return held.reduce(
        (limit, h) => (h.adviserLimit !== undefined ? Math.min(limit, h.adviserLimit) : limit),
        base
    )
}

/**
 * R-7.6.4 — how many advisers a player holds above their limit once `leaving` are gone. A card
 * just received that ignores the limit (Pied Piper) is not counted on its arrival. Read from the
 * public rows, besides the facedown cards `leaving` names, so any view of the table counts the
 * same.
 */
export function advisersOverLimit(
    state: HydratedOathGameState,
    playerId: string,
    receivedCardIds: readonly string[] = [],
    leaving: readonly string[] = []
): number {
    const player = state.getPlayerState(playerId)
    const faceupLeaving = leaving.filter((cardId) => player.isFaceupAdviser(cardId))
    return adviserExcess(
        state,
        playerId,
        receivedCardIds,
        faceupLeaving,
        leaving.length - faceupLeaving.length
    )
}

/**
 * `advisersOverLimit` with the faceup cards leaving named and the facedown ones only counted, so a
 * view that cannot see which facedown cards they are counts the same.
 */
export function adviserExcess(
    state: HydratedOathGameState,
    playerId: string,
    receivedCardIds: readonly string[],
    faceupLeaving: readonly string[],
    facedownLeaving: number
): number {
    const player = state.getPlayerState(playerId)
    return holdingExcess(
        state,
        {
            faceup: player.faceupAdviserIds().filter((cardId) => !faceupLeaving.includes(cardId)),
            facedown: player.advisers.filter((row) => !row.faceUp).length - facedownLeaving,
            relicIds: player.relicIds,
            baseLimit: player.adviserLimit
        },
        receivedCardIds
    )
}

/** R-7.6.4 — a player's advisers as the public rows show them, and the relics held beside them. */
export interface AdviserHolding {
    faceup: readonly string[]
    facedown: number
    relicIds: readonly string[]
    baseLimit: number
}

/**
 * R-7.6.4 — how many advisers `holding` has above its limit, the limit and the exemptions read
 * from the holding itself. A card just received that ignores the limit (Pied Piper) is not counted
 * on its arrival; held, it counts from revision 11 and never before it.
 */
export function holdingExcess(
    state: HydratedOathGameState,
    holding: AdviserHolding,
    receivedCardIds: readonly string[]
): number {
    const held = [...holding.faceup, ...holding.relicIds].flatMap((cardId) =>
        hooksOfCard(state, cardId)
    )
    const piperCounts = isAtLeastOathRevision(state, OathRevision.EngineFixes7)
    const counted = holding.faceup.filter(
        (cardId) =>
            !(
                arrivesIgnoringAdviserLimit(state, cardId) &&
                (receivedCardIds.includes(cardId) || !piperCounts)
            ) && !exemptFromAdviserLimit(held, cardId)
    ).length
    return Math.max(0, holding.facedown + counted - lowestAdviserLimit(holding.baseLimit, held))
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
