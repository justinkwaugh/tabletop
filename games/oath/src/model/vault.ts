import * as Type from 'typebox'
import { assertExists, shuffle, type RandomFunction } from '@tabletop/common'
import { CardKind, Region } from './oathEnums.js'
import { kindOf } from '../data/cardRegistry.js'

/** R-9.4 — everything unknown to every player; index 0 is the top of each list. */
const OathVaultSchema = Type.Object({
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
// Opaque: the platform's type-level projection does not descend into Type.Record.
export const OathVaultState = Type.Unsafe<OathVault>(OathVaultSchema)

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
        const cardId = vault.worldDeck.shift()
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
    return count > 0 ? vault.discardPiles[region].splice(0, count) : []
}

/** R-10.5 — in the order given, so the last id ends up on top. */
export function discardOnto(vault: OathVault, region: Region, cardIds: string[], bottom = false) {
    for (const cardId of cardIds) {
        if (bottom) vault.discardPiles[region].push(cardId)
        else vault.discardPiles[region].unshift(cardId)
    }
}

/** Mushrooms */
export function drawFromDiscardBottom(vault: OathVault, region: Region, count: number): string[] {
    const pile = vault.discardPiles[region]
    return count > 0 ? pile.splice(Math.max(0, pile.length - count), count).reverse() : []
}

/** Scryer, Tavern Songs */
export function peekDiscard(vault: OathVault, region: Region, count?: number): string[] {
    const pile = vault.discardPiles[region]
    return count === undefined ? [...pile] : pile.slice(0, count)
}

/** Convoys */
export function mergeDiscardPiles(vault: OathVault, from: Region, to: Region) {
    if (from === to) return
    vault.discardPiles[to] = [...vault.discardPiles[from], ...vault.discardPiles[to]]
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
    const top = vault.worldDeck[0]
    return top ? kindOf(top) : undefined
}

/** R-1.19, R-1.20 — deepest card first, no Vision interrupt (R-1.22 counts instead). */
export function drawFromBottomOfWorldDeck(vault: OathVault, count: number): string[] {
    if (count <= 0) {
        return []
    }
    // R-9.3
    const taken = vault.worldDeck.splice(Math.max(0, vault.worldDeck.length - count), count)
    return taken.reverse()
}

/** R-1.17, R-5.6.2, R-8.6.2 */
export function drawRelics(vault: OathVault, count: number): string[] {
    return count > 0 ? vault.relicDeck.splice(0, count) : []
}

/** Cracked Horn */
export function putUnderWorldDeck(vault: OathVault, cardIds: string[]) {
    vault.worldDeck.push(...cardIds)
}

/** The Map — "Put this relic on the bottom of the relic deck". */
export function returnRelicToBottom(vault: OathVault, relicCardId: string) {
    vault.relicDeck = vault.relicDeck.filter((id) => id !== relicCardId)
    vault.relicDeck.push(relicCardId)
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

/** R-1.1, R-8.3.5.6 */
export function drawSites(vault: OathVault, count: number): string[] {
    return count > 0 ? vault.siteDeck.splice(0, count) : []
}
