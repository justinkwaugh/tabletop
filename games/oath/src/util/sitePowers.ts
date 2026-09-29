import { pawnSiteId } from './pawn.js'
import { gainFavorFromBank } from './favor.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { sitePowerCategory, siteRecord } from '../data/sites.js'
import { suitOf } from '../data/cardRegistry.js'
import { rulesSite } from './rule.js'
import { gainWarbandsToBoard } from '../powers/vocabulary.js'
import { afterRelicsTakenPersistent } from './persistent.js'
import { takeRelic, clearSiteRelicSlot } from './relics.js'
import { homelandLedgerKey } from './discard.js'
import type { HiddenReveal } from '../model/hidden.js'
import { siteLockedFor } from './locked.js'

/** R-11 — a site's power is its card's, so a facedown slot has none. */

export function categoryAt(
    state: HydratedOathGameState,
    slotId: string | undefined
): string | undefined {
    return sitePowerCategory(state.siteCardAt(slotId))
}

/** R-11.4 — one delta per site, folded separately for R-5.5.3's underflow. */
export function attackDiceFromSites(
    state: HydratedOathGameState,
    targetedSiteIds: readonly string[]
): Array<{ siteId: string; attack: number }> {
    const deltas: Array<{ siteId: string; attack: number }> = []
    for (const siteId of targetedSiteIds) {
        const category = categoryAt(state, siteId)
        if (category === 'plains') deltas.push({ siteId, attack: 1 })
        if (category === 'mountain') deltas.push({ siteId, attack: -1 })
    }
    return deltas
}

/** R-11.5 — River. */
export function riverMusterBonus(state: HydratedOathGameState, playerId: string): number {
    const siteId = pawnSiteId(state, playerId)
    if (categoryAt(state, siteId) !== 'river') return 0
    return rulesSite(state, playerId, siteId) ? 1 : 0
}

/** R-11.2 — read by the resolver, so the relic's identity rides the action as `reveal`; `siteId` is the site played to. */
export function homelandRelicSlot(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    siteId: string
): string | undefined {
    const card = state.siteCardAt(siteId)
    const record = card ? siteRecord(card) : undefined
    const suit = suitOf(cardId)
    if (
        !record?.homeland ||
        record.homeland.reward !== 'relic' ||
        !suit ||
        record.homeland.suit !== suit
    )
        return undefined
    if (
        state
            .getPlayerState(playerId)
            .homelandUsedThisTurn.includes(homelandLedgerKey(siteId, suit))
    )
        return undefined
    // Ancient Bloodline — a relic at a site its holder rules is locked for their enemies.
    if (siteLockedFor(state, playerId, siteId)) return undefined
    return state.relicSlotsAt(siteId)[0]?.slotId
}

export function homelandPayout(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    cardId: string,
    reveal?: HiddenReveal
): string | undefined {
    const card = state.siteCardAt(siteId)
    const record = card ? siteRecord(card) : undefined
    const suit = suitOf(cardId)
    if (!record?.homeland || !suit || record.homeland.suit !== suit) return undefined

    const player = state.getPlayerState(playerId)
    if (player.homelandUsedThisTurn.includes(homelandLedgerKey(siteId, suit))) {
        return `${record.name}: no Homeland gain — a ${suit} card was discarded here this turn (R-11.2)`
    }

    switch (record.homeland.reward) {
        case 'favor': {
            const gained = gainFavorFromBank(state, playerId, suit, 1)
            return `${record.name} (Homeland): gained ${gained} ${suit} favor`
        }
        case 'secret': {
            player.secrets += 1
            return `${record.name} (Homeland): gained a secret`
        }
        case 'warbands': {
            const gained = gainWarbandsToBoard(state, playerId, record.homeland.amount)
            return `${record.name} (Homeland): gained ${gained} warbands`
        }
        case 'relic': {
            // The resolver's reveal; absent on the client's optimistic run, which is discarded.
            const slot = state.relicSlotsAt(siteId)[0]
            if (!slot) return `${record.name} (Homeland): no relic here to take`
            if (siteLockedFor(state, playerId, siteId)) {
                return `${record.name} (Homeland): the relic here is locked (Ancient Bloodline)`
            }
            const relicCardId = reveal?.kind === 'relic' ? reveal.relicCardId : undefined
            if (!relicCardId)
                return `${record.name} (Homeland): the relic's identity is not yet known`
            clearSiteRelicSlot(state, siteId, slot.slotId)
            takeRelic(state, player.playerId, relicCardId)
            // R-11.2-H1 — taken as a Recover takes it, so "after a player takes relics" powers fire.
            const notes = afterRelicsTakenPersistent(state, playerId, [relicCardId])
            return `${record.name} (Homeland): took ${relicCardId}${notes.length ? ` (${notes.join('; ')})` : ''}`
        }
    }
}
