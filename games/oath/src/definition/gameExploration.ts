import {
    assertExists,
    shuffle,
    type ExplorationPopulation,
    type GameExploration,
    type RandomFunction
} from '@tabletop/common'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { CardKind, Region } from '../model/oathEnums.js'
import { kindOf } from '../data/cardRegistry.js'
import type { OathVault } from '../model/vault.js'
import type { HydratedOathPlayerState } from '../model/playerState.js'
import { populateHiddenCards } from '../util/exploration.js'

/** R-9.4 — re-deals unknown cards from a new protected stream, so a branch foretells nothing. */
export class OathGameExploration implements GameExploration<OathProjectedState> {
    /** Host View: each hidden list keeps its cards; what any player has seen stays where they saw it. */
    createFromCanonicalState(state: OathProjectedState): OathProjectedState {
        const hydrated = new HydratedOathGameState(structuredClone(state))
        const vault = hydrated.requireVault()
        const random = hydrated.getProtectedPrng().random
        vault.worldDeck = reshuffledWorldDeck(vault.worldDeck, knownTopLength(hydrated), random)
        for (const region of Object.values(Region)) {
            const pile = vault.discardPiles[region]
            vault.discardPiles[region] = withTopBackKept(
                pile,
                knownPileIndexes(hydrated, region, pile.length),
                random
            )
        }
        shuffle(vault.dispossessed, random)
        redealSites(vault, peekedSiteSlots(hydrated), random)
        redealRelics(vault, peekedRelicSlots(hydrated), knownRelicDeckIndexes(hydrated), random)
        return hydrated.dehydrate()
    }

    /** A player or spectator: every card their projection does not name is dealt afresh. */
    createFromProjectedState({
        state,
        random
    }: ExplorationPopulation<OathProjectedState>): OathProjectedState {
        return populateHiddenCards(state, random)
    }
}

function isVision(cardId: string): boolean {
    return kindOf(cardId) === CardKind.Vision
}

/** R-8.8 keeps every Vision above the deck's Vision-free tail, and R-9.4 shows the top back. */
function reshuffledWorldDeck(
    deck: readonly string[],
    known: number,
    random: RandomFunction
): string[] {
    const rest = deck.slice(known)
    const reach = rest.findLastIndex(isVision) + 1
    const visions = rest.filter(isVision)
    const denizens = rest.filter((cardId) => !isVision(cardId))
    shuffle(denizens, random)
    const head = [...visions, ...denizens.splice(0, reach - visions.length)]
    shuffle(head, random)
    const reshuffled = [...head, ...denizens]
    return [
        ...deck.slice(0, known),
        ...(known === 0 ? keepTopBack(deck, reshuffled, reach) : reshuffled)
    ]
}

/** R-9.4 — a discard pile's top back is public; a card a player has seen stays where it is. */
function withTopBackKept(
    pile: readonly string[],
    known: ReadonlySet<number>,
    random: RandomFunction
): string[] {
    const free = pile.map((_, index) => index).filter((index) => !known.has(index))
    const cards = free.map((index) => pile[index])
    shuffle(cards, random)
    const reshuffled = [...pile]
    for (const [at, index] of free.entries()) reshuffled[index] = cards[at]
    if (known.has(0)) return reshuffled
    return keepTopBack(pile, reshuffled, reshuffled.length, known)
}

// R-9.4 — the swap stays within `within` so a Vision never leaves R-8.8's reach.
function keepTopBack(
    source: readonly string[],
    cards: string[],
    within: number,
    fixed: ReadonlySet<number> = new Set()
): string[] {
    const top = source[0]
    if (top === undefined) return cards
    const back = kindOf(top)
    const index = cards.findIndex(
        (cardId, at) => at < within && !fixed.has(at) && kindOf(cardId) === back
    )
    if (index > 0) [cards[0], cards[index]] = [cards[index], cards[0]]
    return cards
}

/** Oracular Pig — the most any player has seen of the world deck's top. */
function knownTopLength(state: HydratedOathGameState): number {
    return Math.max(0, ...state.players.map((player) => knownOf(player).worldDeckTop.length))
}

/** A pile's positions, from its top, that the table or some player has seen. */
function knownPileIndexes(state: HydratedOathGameState, region: Region, size: number): Set<number> {
    return new Set(
        [
            state.seenDiscardPiles[region],
            ...state.players.map((player) => knownOf(player).discardPiles[region])
        ].flatMap((known) =>
            known.flatMap((cardId, fromBottom) => (cardId === null ? [] : [size - 1 - fromBottom]))
        )
    )
}

/** Relic deck positions, from its top, that some player saw a relic sent to. */
function knownRelicDeckIndexes(state: HydratedOathGameState): Set<number> {
    const size = state.requireVault().relicDeck.length
    return new Set(
        state.players.flatMap((player) => {
            const known = knownOf(player).relicDeckBottom
            return known.flatMap((cardId, index) =>
                cardId === null ? [] : [size - known.length + index]
            )
        })
    )
}

function knownOf(player: HydratedOathPlayerState) {
    const { knownWorldDeckTop, knownDiscardPiles, knownRelicDeckBottom } = player
    assertExists(knownWorldDeckTop, 'Host View exploration requires every player’s knowledge')
    assertExists(knownDiscardPiles, 'Host View exploration requires every player’s knowledge')
    assertExists(knownRelicDeckBottom, 'Host View exploration requires every player’s knowledge')
    return {
        worldDeckTop: knownWorldDeckTop,
        discardPiles: knownDiscardPiles,
        relicDeckBottom: knownRelicDeckBottom
    }
}

/** R-2.8.2, R-8.3.5.6 — a facedown site may be any site no player has seen; one peeked at stays the site they saw. */
function redealSites(vault: OathVault, peeked: ReadonlySet<string>, random: RandomFunction) {
    const slots = Object.keys(vault.siteFacedown).filter((slotId) => !peeked.has(slotId))
    const pool = [...slots.map((slotId) => vault.siteFacedown[slotId]), ...vault.siteDeck]
    shuffle(pool, random)
    for (const [index, slotId] of slots.entries()) vault.siteFacedown[slotId] = pool[index]
    vault.siteDeck = pool.slice(slots.length)
}

/** R-1.17, R-1.18, R-6.3 — a relic someone has peeked at, or seen go to the bottom, stays where they saw it. */
function redealRelics(
    vault: OathVault,
    peeked: ReadonlySet<string>,
    knownInDeck: ReadonlySet<number>,
    random: RandomFunction
) {
    const slots = Object.keys(vault.relicFacedown).filter((slotId) => !peeked.has(slotId))
    const deckIndexes = vault.relicDeck
        .map((_, index) => index)
        .filter((index) => !knownInDeck.has(index))
    const pool = [
        ...slots.map((slotId) => vault.relicFacedown[slotId]),
        ...deckIndexes.map((index) => vault.relicDeck[index])
    ]
    shuffle(pool, random)
    for (const [index, slotId] of slots.entries()) vault.relicFacedown[slotId] = pool[index]
    const relicDeck = [...vault.relicDeck]
    for (const [at, index] of deckIndexes.entries()) relicDeck[index] = pool[slots.length + at]
    vault.relicDeck = relicDeck
}

function peekedRelicSlots(state: HydratedOathGameState): Set<string> {
    return new Set(state.players.flatMap((player) => player.peekedRelicSlotIds))
}

function peekedSiteSlots(state: HydratedOathGameState): Set<string> {
    return new Set(state.players.flatMap((player) => player.peekedSiteSlotIds))
}
