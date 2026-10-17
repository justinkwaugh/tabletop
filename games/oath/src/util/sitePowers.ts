import { pawnSiteId } from './pawn.js'
import { gainFavorFromBank } from './favor.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { sitePowerCategory, siteRecord, type HomelandReward } from '../data/sites.js'
import type { Suit } from '../model/oathEnums.js'
import { suitOf } from '../data/cardRegistry.js'
import { rulesSite } from './rule.js'
import { gainedWarbandsWords, gainWarbandsToBoard } from './force.js'
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

/** R-11.2 — a site's Homeland power, met by a card of its suit played there. */
export interface HomelandPower {
    name: string
    suit: Suit
    reward: HomelandReward
    amount: number
    /** "you have not discarded a card here of this suit during this turn". */
    barred: boolean
}

/**
 * R-11.2 — the Homeland power a card played to this site meets, if any. `discardedFirst` holds the ledger keys
 * (`homelandLedgerKey`) of the discards the play makes before the card lands, which a plan of the play reads
 * before they are written to the player's ledger.
 */
export function homelandPowerFor(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    cardId: string,
    discardedFirst: readonly string[] = []
): HomelandPower | undefined {
    const card = state.siteCardAt(siteId)
    const record = card ? siteRecord(card) : undefined
    const suit = suitOf(cardId)
    if (!record?.homeland || !suit || record.homeland.suit !== suit) return undefined
    const key = homelandLedgerKey(siteId, suit)
    const barred =
        state.getPlayerState(playerId).homelandUsedThisTurn.includes(key) ||
        discardedFirst.includes(key)
    return { ...record.homeland, name: record.name, suit, barred }
}

export function homelandPayout(
    state: HydratedOathGameState,
    playerId: string,
    siteId: string,
    cardId: string,
    reveal?: HiddenReveal
): string | undefined {
    const homeland = homelandPowerFor(state, playerId, siteId, cardId)
    if (!homeland) return undefined
    const { name, suit } = homeland

    const player = state.getPlayerState(playerId)
    if (homeland.barred) {
        return `${name}: no Homeland gain — a ${suit} card was discarded here this turn (R-11.2)`
    }

    switch (homeland.reward) {
        case 'favor': {
            const gained = gainFavorFromBank(state, playerId, suit, 1)
            return `${name} (Homeland): gained ${gained} ${suit} favor`
        }
        case 'secret': {
            player.secrets += 1
            return `${name} (Homeland): gained a secret`
        }
        case 'warbands': {
            const gained = gainWarbandsToBoard(state, playerId, homeland.amount)
            const words = gainedWarbandsWords(state, playerId, gained) ?? `${gained} warbands`
            return `${name} (Homeland): gained ${words}`
        }
        case 'relic': {
            // The resolver's reveal; absent on the client's optimistic run, which is discarded, and for Land
            // Warden's second card, whose play draws no hidden card (docs/known-deviations.md).
            const slot = state.relicSlotsAt(siteId)[0]
            if (!slot) return `${name} (Homeland): no relic here to take`
            if (siteLockedFor(state, playerId, siteId)) {
                return `${name} (Homeland): the relic here is locked (Ancient Bloodline)`
            }
            const relicCardId = reveal?.kind === 'relic' ? reveal.relicCardId : undefined
            if (!relicCardId)
                return `${name} (Homeland): no relic was drawn for this play, so none was taken`
            clearSiteRelicSlot(state, siteId, slot.slotId)
            takeRelic(state, player.playerId, relicCardId)
            // R-11.2-H1 — taken as a Recover takes it, so "after a player takes relics" powers fire.
            const notes = afterRelicsTakenPersistent(state, playerId, [relicCardId])
            return `${name} (Homeland): took ${relicCardId}${notes.length ? ` (${notes.join('; ')})` : ''}`
        }
    }
}
