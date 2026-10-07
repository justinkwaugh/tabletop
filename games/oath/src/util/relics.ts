import { HydratedOathGameState } from '../model/gameState.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { recordGrandScepterTaken } from './imperial.js'
import { afterRelicsTakenPersistent } from './persistent.js'

/** R-6.4 — taking the Grand Scepter is recorded, since it cannot be used that turn. */
export function takeRelic(state: HydratedOathGameState, playerId: string, cardId: string): void {
    state.getPlayerState(playerId).relicIds.push(cardId)
    if (cardId === GRAND_SCEPTER_ID) recordGrandScepterTaken(state)
}

/** Relic Thief — "After a player takes any relics": every take, however it is made, is reported. */
export function takeRelics(
    state: HydratedOathGameState,
    playerId: string,
    cardIds: readonly string[]
): string[] {
    for (const cardId of cardIds) takeRelic(state, playerId, cardId)
    return afterRelicsTakenPersistent(state, playerId, cardIds)
}

/** The notes a take's watchers leave, as a summary's tail. */
export function takeNotes(notes: readonly string[]): string {
    return notes.length > 0 ? ` (${notes.join('; ')})` : ''
}

/** A take from another player; a relic given in an exchange is `giveRelic`. */
export function takeRelicsFrom(
    state: HydratedOathGameState,
    fromId: string,
    toId: string,
    cardIds: readonly string[]
): string[] {
    for (const cardId of cardIds) releaseRelic(state, fromId, cardId)
    return takeRelics(state, toId, cardIds)
}

export function releaseRelic(state: HydratedOathGameState, playerId: string, cardId: string): void {
    const player = state.getPlayerState(playerId)
    player.relicIds = player.relicIds.filter((id) => id !== cardId)
}

/** R-10.8, R-10.11 — the Grand Scepter's Q&A: "Take and give are unique keywords", so a given Scepter is usable at once. */
export function giveRelic(
    state: HydratedOathGameState,
    fromId: string,
    toId: string,
    cardId: string
): void {
    releaseRelic(state, fromId, cardId)
    state.getPlayerState(toId).relicIds.push(cardId)
}

/** R-2.8.2 — the slot leaves the site with its relic. */
export function clearSiteRelicSlot(state: HydratedOathGameState, siteId: string, slotId: string) {
    state.relicsBySite[siteId] = state.relicSlotsAt(siteId).filter((s) => s.slotId !== slotId)
}

/** R-2.3 — the space is uncovered; the traits follow from the count. */
export function clearReliquarySlot(state: HydratedOathGameState, slotId: string) {
    state.reliquary = state.reliquarySlots().filter((s) => s.slotId !== slotId)
}
