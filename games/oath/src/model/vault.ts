import * as Type from 'typebox'
import { assert, assertExists, shuffle, type RandomFunction } from '@tabletop/common'
import { CardKind, Region } from './oathEnums.js'
import { kindOf } from '../data/cardRegistry.js'
import {
    drawFromBottom,
    drawFromTop,
    putOnTop,
    putPileOnTop,
    putUnderneath,
    putUnderTop,
    topCards,
    topOf
} from './pileOrder.js'

/** R-9.4 — everything unknown to every player; index 0 is the top of each list. */
export const OathVaultSchema = Type.Object({
    worldDeck: Type.Array(Type.String()),
    /** R-2.1.2, R-9.4 — fronts in all piles are private; R-10.5 places on top, R-10.6 draws it. */
    discardPiles: Type.Record(Type.Enum(Region), Type.Array(Type.String())),
    /** R-2.8.2, R-5.6.2 */
    siteFacedown: Type.Record(Type.String(), Type.String()),
    /** R-1.17, R-2.8.2 */
    relicFacedown: Type.Record(Type.String(), Type.String()),
    /** R-1.18 */
    relicDeck: Type.Array(Type.String()),
    /** R-8.3.5.6 */
    siteDeck: Type.Array(Type.String()),
    /** R-8.5 — placed "without looking", so unknown to every player (R-9.4). */
    dispossessed: Type.Array(Type.String())
})
export type OathVault = Type.Static<typeof OathVaultSchema>

export function createOathVault(
    contents: {
        worldDeck?: string[]
        /** R-8.8 — overrides `worldDeck`; a structured deck cannot be shuffled flat. */
        composeWorldDeck?: (random: RandomFunction) => string[]
        discardPiles?: Partial<Record<Region, string[]>>
        siteFacedown?: Record<string, string>
        relicFacedown?: Record<string, string>
        /** Shuffled with the vault seed (R-1.18). */
        relicDeck?: string[]
        /** Shuffled with the vault seed (R-1.1, R-8.3.5.6). */
        siteDeck?: string[]
    },
    random: RandomFunction
): OathVault {
    let worldDeck: string[]
    if (contents.composeWorldDeck) {
        worldDeck = contents.composeWorldDeck(random)
    } else {
        worldDeck = [...(contents.worldDeck ?? [])]
        shuffle(worldDeck, random)
    }

    const relicDeck = [...(contents.relicDeck ?? [])]
    shuffle(relicDeck, random)
    const siteDeck = [...(contents.siteDeck ?? [])]
    shuffle(siteDeck, random)

    return {
        worldDeck,
        discardPiles: {
            [Region.Cradle]: [...(contents.discardPiles?.[Region.Cradle] ?? [])],
            [Region.Provinces]: [...(contents.discardPiles?.[Region.Provinces] ?? [])],
            [Region.Hinterland]: [...(contents.discardPiles?.[Region.Hinterland] ?? [])]
        },
        siteFacedown: { ...(contents.siteFacedown ?? {}) },
        relicFacedown: { ...(contents.relicFacedown ?? {}) },
        relicDeck,
        siteDeck,
        dispossessed: []
    }
}

/**
 * R-8.7, R-1.1 — a continued game's vault: each list exactly as given, in its order, and nothing
 * shuffled. R-8.8 built the world deck and R-8.6.3 stacked the relic deck; setup reads both as
 * they lie.
 */
export function carriedOathVault(contents: Partial<OathVault>): OathVault {
    return {
        worldDeck: [...(contents.worldDeck ?? [])],
        discardPiles: {
            [Region.Cradle]: [...(contents.discardPiles?.[Region.Cradle] ?? [])],
            [Region.Provinces]: [...(contents.discardPiles?.[Region.Provinces] ?? [])],
            [Region.Hinterland]: [...(contents.discardPiles?.[Region.Hinterland] ?? [])]
        },
        siteFacedown: { ...(contents.siteFacedown ?? {}) },
        relicFacedown: { ...(contents.relicFacedown ?? {}) },
        relicDeck: [...(contents.relicDeck ?? [])],
        siteDeck: [...(contents.siteDeck ?? [])],
        dispossessed: [...(contents.dispossessed ?? [])]
    }
}

/** R-5.1.2 */
export interface WorldDeckDraw {
    /** Fewer than asked for if the draw stopped (R-5.1.2, R-9.3). */
    drawn: string[]
    /** R-5.1.2, R-2.7.1 */
    stoppedOnVision: boolean
    /** R-9.4 */
    topBackType?: CardKind
}

/** R-5.1.2, R-10.6 — a Vision stops the draw and is itself drawn. Mutates the vault (R-X.3). */
export function drawFromWorldDeck(vault: OathVault, count: number): WorldDeckDraw {
    const drawn: string[] = []
    let stoppedOnVision = false

    while (drawn.length < count && vault.worldDeck.length > 0) {
        const [cardId] = drawFromTop(vault.worldDeck, 1)
        assertExists(cardId, 'The world deck was non-empty a moment ago')
        drawn.push(cardId)
        if (kindOf(cardId) === CardKind.Vision) {
            stoppedOnVision = true
            break
        }
    }

    return { drawn, stoppedOnVision, topBackType: topBackType(vault) }
}

/** R-5.1.2, R-10.6 — no Vision interrupt; R-2.7.1 advances only on a world deck draw. */
export function drawFromDiscard(vault: OathVault, region: Region, count: number): string[] {
    return drawFromTop(vault.discardPiles[region], count)
}

/** R-10.5 — in the order given, so the last id ends up on top. */
export function discardOnto(vault: OathVault, region: Region, cardIds: string[], bottom = false) {
    if (bottom) putUnderneath(vault.discardPiles[region], cardIds)
    else putOnTop(vault.discardPiles[region], cardIds)
}

/** Land Warden — under the top `beneath` cards of the pile, the last of `cardIds` nearest them. */
export function discardUnder(
    vault: OathVault,
    region: Region,
    cardIds: readonly string[],
    beneath: number
) {
    putUnderTop(vault.discardPiles[region], cardIds, beneath)
}

/** Mushrooms */
export function drawFromDiscardBottom(vault: OathVault, region: Region, count: number): string[] {
    return drawFromBottom(vault.discardPiles[region], count)
}

/** Scryer, Tavern Songs */
export function peekDiscard(vault: OathVault, region: Region, count?: number): string[] {
    const pile = vault.discardPiles[region]
    return count === undefined ? [...pile] : topCards(pile, count)
}

/** Convoys */
export function mergeDiscardPiles(vault: OathVault, from: Region, to: Region) {
    if (from === to) return
    putPileOnTop(vault.discardPiles[to], vault.discardPiles[from])
    vault.discardPiles[from] = []
}

/** Oracle */
export function drawFirstVision(vault: OathVault): string | undefined {
    const at = vault.worldDeck.findIndex((id) => id.startsWith('vision.'))
    if (at < 0) return undefined
    return vault.worldDeck.splice(at, 1)[0]
}

/** R-9.4 — the first back is public. */
export function topBackType(vault: OathVault): CardKind | undefined {
    const top = topOf(vault.worldDeck)
    return top ? kindOf(top) : undefined
}

/** R-1.19, R-1.20 — deepest card first, no Vision interrupt (R-1.22 counts instead). */
export function drawFromBottomOfWorldDeck(vault: OathVault, count: number): string[] {
    // R-9.3
    return drawFromBottom(vault.worldDeck, count)
}

/** R-1.17, R-5.6.2, R-8.6.2 */
export function drawRelics(vault: OathVault, count: number): string[] {
    return drawFromTop(vault.relicDeck, count)
}

/** Cracked Horn */
export function putUnderWorldDeck(vault: OathVault, cardIds: string[]) {
    putUnderneath(vault.worldDeck, cardIds)
}

/** The Map — "Put this relic on the bottom of the relic deck". */
export function returnRelicToBottom(vault: OathVault, relicCardId: string) {
    vault.relicDeck = vault.relicDeck.filter((id) => id !== relicCardId)
    putUnderneath(vault.relicDeck, [relicCardId])
}

/** Pilgrimage — the cards go in before the shuffle, so the draw never comes up short. */
export function exchangeWithDispossessed(
    vault: OathVault,
    cardIds: readonly string[],
    random: RandomFunction
): string[] {
    vault.dispossessed.push(...cardIds)
    shuffle(vault.dispossessed, random)
    return vault.dispossessed.splice(0, cardIds.length)
}

/**
 * Great Spire, Fallen Spire — R-10.25: each card trades places with a random card from the
 * Dispossessed. The random cards are taken before the swapped ones go in, so none comes straight back.
 */
export function swapWithDispossessed(
    vault: OathVault,
    cardIds: readonly string[],
    random: RandomFunction
): string[] {
    assert(
        cardIds.length <= vault.dispossessed.length,
        `${cardIds.length} cards cannot swap with a Dispossessed of ${vault.dispossessed.length}`
    )
    shuffle(vault.dispossessed, random)
    const taken = vault.dispossessed.splice(0, cardIds.length)
    vault.dispossessed.push(...cardIds)
    return taken
}

/** R-1.1, R-8.3.5.6 */
export function drawSites(vault: OathVault, count: number): string[] {
    return drawFromTop(vault.siteDeck, count)
}
