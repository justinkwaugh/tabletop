import { regionOfPawn } from './pawn.js'
import { assertExists } from '@tabletop/common'
import { HydratedOathGameState, discardRegionFor } from '../model/gameState.js'
import { Region, CardKind, type Suit } from '../model/oathEnums.js'
import { isVision, suitOf } from '../data/cardRegistry.js'
import type { PileDeposit } from '../model/hidden.js'
import { siteHolding } from './access.js'

/** Bracken, Cracked Horn */
export interface DiscardTarget {
    region: Region
    bottom: boolean
    worldDeck?: boolean
}

// R-10.5, R-9.4 — the pile's fronts are secret, so the deposit rides the action for `commitHiddenOutputs`.
export function discardCards(
    state: HydratedOathGameState,
    actingPlayerId: string,
    cardIds: readonly string[],
    fromRegion: Region,
    target?: DiscardTarget
): PileDeposit[] {
    const targetRegion = target?.region ?? discardRegionFor(fromRegion)

    // Cracked Horn — under the world deck, touching no pile; R-9.4 shows the new top back of an empty deck.
    if (target?.worldDeck) {
        const [first] = cardIds
        if (first !== undefined && state.worldDeckExhausted) state.topCardBackType = backOf(first)
        if (first !== undefined) state.worldDeckExhausted = false
        for (const cardId of cardIds) returnTokensFrom(state, actingPlayerId, cardId)
        return []
    }

    for (const cardId of cardIds) {
        returnTokensFrom(state, actingPlayerId, cardId)

        const wasEmpty = state.discardPileCounts[targetRegion] === 0
        state.discardPileCounts[targetRegion] += 1

        // R-9.4 — the top card's back is public, and denizen and Vision backs differ.
        if (!target?.bottom || wasEmpty) {
            state.discardTopBackType = {
                ...state.discardTopBackType,
                [targetRegion]: backOf(cardId)
            }
        }
    }

    if (cardIds.length === 0) return []
    return [{ region: targetRegion, cardIds: [...cardIds], bottom: target?.bottom || undefined }]
}

function backOf(cardId: string): CardKind {
    return isVision(cardId) ? CardKind.Vision : CardKind.Denizen
}

/** R-10.5 — favor to the matching bank, secrets facedown to the acting player's board (R-7.1.2.a). */
export function returnTokensFrom(
    state: HydratedOathGameState,
    actingPlayerId: string,
    cardId: string
) {
    const tokens = state.tokensOn(cardId)
    if (tokens.favor > 0) {
        // R-5.2.1 and R-5.3.2 only put favor on suited cards.
        const suit = suitOf(cardId)
        assertExists(suit, `${cardId} has no suit, so it cannot hold favor`)
        state.favorBank[suit] += tokens.favor
    }
    if (tokens.secrets > 0) {
        state.getPlayerState(actingPlayerId).secretsFacedown += tokens.secrets
    }
    delete state.cardTokens[cardId]
}

export function isInPlay(state: HydratedOathGameState, cardId: string): boolean {
    return siteHolding(state, cardId) !== undefined || state.adviserHolderOf(cardId) !== undefined
}

export function homelandLedgerKey(siteId: string, suit: Suit): string {
    return `${siteId}:${suit}`
}

/** R-11.2 — "you have not discarded a card here of this suit during this turn". */
export function noteSiteDiscard(
    state: HydratedOathGameState,
    actingPlayerId: string,
    cardId: string
): void {
    const siteId = siteHolding(state, cardId)
    const suit = suitOf(cardId)
    if (siteId === undefined || !suit) return
    const ledger = state.getPlayerState(actingPlayerId).homelandUsedThisTurn
    const key = homelandLedgerKey(siteId, suit)
    if (!ledger.includes(key)) ledger.push(key)
}

export function detachFromPlay(state: HydratedOathGameState, cardId: string): boolean {
    const siteId = siteHolding(state, cardId)
    if (siteId !== undefined) {
        state.denizensBySite[siteId] = state.denizensBySite[siteId].filter((id) => id !== cardId)
        return true
    }
    const holder = state.adviserHolderOf(cardId)
    if (!holder) return false
    holder.removeAdviser(cardId)
    return true
}

/** Law Glossary "Discard" — a card at a site leaves from the site's region, an adviser from its holder's pawn. */
export function regionCardLeavesFrom(state: HydratedOathGameState, cardId: string): Region {
    const siteId = siteHolding(state, cardId)
    if (siteId !== undefined) return state.regionOf(siteId)
    const holder = state.adviserHolderOf(cardId)
    assertExists(holder, `${cardId} is in play, at a site or as an adviser`)
    return regionOfPawn(state, holder.playerId)
}

/** R-10.5 — each card is discarded from its own region. */
export function discardEachFromPlay(
    state: HydratedOathGameState,
    actingPlayerId: string,
    cardIds: readonly string[]
): PileDeposit[] {
    const deposits: PileDeposit[] = []
    for (const cardId of cardIds) {
        if (!isInPlay(state, cardId)) continue
        const fromRegion = regionCardLeavesFrom(state, cardId)
        noteSiteDiscard(state, actingPlayerId, cardId)
        detachFromPlay(state, cardId)
        for (const deposit of discardCards(state, actingPlayerId, [cardId], fromRegion)) {
            const pile = deposits.find((d) => d.region === deposit.region)
            if (pile) pile.cardIds.push(...deposit.cardIds)
            else deposits.push(deposit)
        }
    }
    return deposits
}
