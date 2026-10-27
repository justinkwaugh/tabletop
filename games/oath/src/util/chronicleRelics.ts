import { assertExists } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'
import type { ChronicleRelicsRecord } from '../model/chronicle.js'
import { siteRevealPrompt } from '../data/cardRegistry.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { chronicleWinnerOf } from './chronicleChoices.js'
import { ChronicleShuffle, chronicleShuffles } from './chronicleRandom.js'
import { relicSlotIdAt, renameRelicSlotsAt } from './chronicleMap.js'
import {
    drawRelicDeck,
    forgetRelicDeckOrder,
    forgetRelicSlots,
    rememberRelicAt
} from './knowledge.js'

/**
 * R-8.6 — box the Grand Scepter, return the losers' relics and shuffle the relic deck (8.6.1);
 * top up every faceup site to its "R" icons (8.6.2); stack the winner's relics and the
 * Reliquary's, shuffled, on the deck (8.6.3).
 */
export function cleanUpRelics(state: HydratedOathGameState): ChronicleRelicsRecord {
    const vault = state.requireVault()
    const winner = state.getPlayerState(chronicleWinnerOf(state))

    // 8.6.1
    boxGrandScepter(state)
    const returned: ChronicleRelicsRecord['returned'] = []
    for (const player of state.players) {
        if (player === winner || player.relicIds.length === 0) continue
        returned.push({ playerId: player.playerId, count: player.relicIds.length })
        vault.relicDeck.push(...player.relicIds)
        player.relicIds = []
    }
    chronicleShuffles.shuffle(state, ChronicleShuffle.RelicDeck, vault.relicDeck)
    forgetRelicDeckOrder(state)

    // 8.6.2 — R-9.3: a short deck gives what it holds.
    const placed: ChronicleRelicsRecord['placed'] = []
    for (const slotId of state.faceupSiteIds()) {
        const icons = siteRevealPrompt(state.siteCardAt(slotId))?.relics ?? 0
        const held = state.relicSlotsAt(slotId)
        if (held.length >= icons) continue
        const drawn = drawRelicDeck(state, icons - held.length)
        const slots = drawn.relicCardIds.map((relicCardId, k) => {
            const relicSlotId = relicSlotIdAt(slotId, held.length + k)
            vault.relicFacedown[relicSlotId] = relicCardId
            rememberRelicAt(state, relicSlotId, relicCardId, drawn.seenBy[k])
            return { slotId: relicSlotId }
        })
        if (slots.length === 0) continue
        state.relicsBySite[slotId] = [...held, ...slots]
        placed.push({ slotId, count: slots.length })
    }

    // 8.6.3
    const reliquarySlotIds = state.reliquarySlots().map((slot) => slot.slotId)
    const fromReliquary = reliquarySlotIds.map((slotId) => {
        const relicCardId = vault.relicFacedown[slotId]
        assertExists(relicCardId, `R-9.4 — the vault holds the Reliquary's relic at ${slotId}`)
        delete vault.relicFacedown[slotId]
        return relicCardId
    })
    forgetRelicSlots(state, reliquarySlotIds)
    state.reliquary = []
    const stacked = { winner: winner.relicIds.length, reliquary: fromReliquary.length }
    const stack = [...winner.relicIds, ...fromReliquary]
    winner.relicIds = []
    chronicleShuffles.shuffle(state, ChronicleShuffle.RelicStack, stack)
    vault.relicDeck.unshift(...stack)
    return { returned, placed, stacked }
}

/**
 * R-8.6.1-H1 — the Grand Scepter goes to the box wherever it is: a player, a site, the Reliquary
 * or the relic deck. The box is this game's (R-5.1.4.IV-H1); R-1.8 hands the card to the next
 * Chancellor.
 */
function boxGrandScepter(state: HydratedOathGameState): void {
    const vault = state.requireVault()
    const holder = state.relicHolderOf(GRAND_SCEPTER_ID)
    if (holder !== undefined) {
        holder.relicIds = holder.relicIds.filter((cardId) => cardId !== GRAND_SCEPTER_ID)
    } else if (vault.relicDeck.includes(GRAND_SCEPTER_ID)) {
        vault.relicDeck = vault.relicDeck.filter((cardId) => cardId !== GRAND_SCEPTER_ID)
    } else {
        const slotId = Object.keys(vault.relicFacedown).find(
            (candidate) => vault.relicFacedown[candidate] === GRAND_SCEPTER_ID
        )
        assertExists(
            slotId,
            'R-8.6.1-H1 — the Grand Scepter is held, at a site, in the Reliquary or in the relic deck'
        )
        delete vault.relicFacedown[slotId]
        forgetRelicSlots(state, [slotId])
        const atSite = state.findRelicSlot(slotId)
        if (atSite === undefined) {
            state.reliquary = state.reliquary.filter((slot) => slot.slotId !== slotId)
        } else {
            state.relicsBySite[atSite.siteId] = state
                .relicSlotsAt(atSite.siteId)
                .filter((slot) => slot.slotId !== slotId)
            renameRelicSlotsAt(state, atSite.siteId)
        }
    }
    state.boxIds = [...state.boxIds, GRAND_SCEPTER_ID]
}
