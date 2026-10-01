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
import type { HydratedOathPlayerState, TablePositions } from '../model/playerState.js'
import { populateHiddenCards } from '../util/exploration.js'

/** R-9.4 — re-deals unknown cards from a new protected stream, so a branch foretells nothing. */
export class OathGameExploration implements GameExploration<OathProjectedState> {
    /** Host View: each hidden list keeps its cards; what any player has seen stays where they saw it. */
    createFromCanonicalState(state: OathProjectedState): OathProjectedState {
        const hydrated = new HydratedOathGameState(structuredClone(state))
        const vault = hydrated.requireVault()
        const random = hydrated.getProtectedPrng().random
        vault.worldDeck = reshuffledWorldDeck(
            vault.worldDeck,
            knownTopLength(hydrated),
            knownBottomLength(hydrated),
            knownBottomIndexes(hydrated),
            random
        )
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
    knownBottom: number,
    namedBottom: ReadonlySet<number>,
    random: RandomFunction
): string[] {
    // X-13 — on a short deck the known top and known bottom can meet.
    const under = Math.max(known, deck.length - knownBottom)
    const bottom = deck.slice(under)
    const rest = deck.slice(known, under)
    const reach = rest.findLastIndex(isVision) + 1
    const visions = rest.filter(isVision)
    const denizens = rest.filter((cardId) => !isVision(cardId))
    shuffle(denizens, random)
    const head = [...visions, ...denizens.splice(0, reach - visions.length)]
    shuffle(head, random)
    const reshuffled = [...head, ...denizens]
    return [
        ...deck.slice(0, known),
        ...(known === 0 ? keepTopBack(deck, reshuffled, reach) : reshuffled),
        ...withTopBackKept(
            bottom,
            new Set(
                [...namedBottom]
                    .map((fromBottom) => bottom.length - 1 - fromBottom)
                    .filter((at) => at >= 0)
            ),
            random
        )
    ]
}

/** Cracked Horn — the places under the world deck, from the bottom, where some record names a card. */
function knownBottomIndexes(state: HydratedOathGameState): Set<number> {
    return new Set(
        [
            state.seenWorldDeckBottom,
            ...state.players.map((player) => knownOf(player).worldDeckBottom)
        ].flatMap((known) =>
            known.flatMap((entry, fromBottom) => (names(entry) ? [fromBottom] : []))
        )
    )
}

/** R-9.4 — a record's place that says which card, or which cards, may lie there; a back alone says neither. */
function names(entry: TablePositions[number]): boolean {
    return entry !== null && (typeof entry === 'string' || 'among' in entry)
}

/** Cracked Horn — the most the table or any player has seen go under the world deck. */
function knownBottomLength(state: HydratedOathGameState): number {
    return Math.max(
        state.seenWorldDeckBottom.length,
        ...state.players.map((player) => knownOf(player).worldDeckBottom.length)
    )
}

/**
 * R-9.4 — every back that went onto a pile was seen, so a card trades places only with one of its own
 * back; a card a player has seen stays where it is.
 */
function withTopBackKept(
    pile: readonly string[],
    known: ReadonlySet<number>,
    random: RandomFunction
): string[] {
    const reshuffled = [...pile]
    for (const back of new Set(pile.map(kindOf))) {
        const free = pile
            .map((_, index) => index)
            .filter((index) => !known.has(index) && kindOf(pile[index]) === back)
        const cards = free.map((index) => pile[index])
        shuffle(cards, random)
        for (const [at, index] of free.entries()) reshuffled[index] = cards[at]
    }
    return reshuffled
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

/** A pile's positions, from its top, where the table or some player has seen which card lies. */
function knownPileIndexes(state: HydratedOathGameState, region: Region, size: number): Set<number> {
    return new Set(
        [
            state.seenDiscardPiles[region],
            ...state.players.map((player) => knownOf(player).discardPiles[region])
        ].flatMap((known) =>
            known.flatMap((entry, fromBottom) => (names(entry) ? [size - 1 - fromBottom] : []))
        )
    )
}

/** Relic deck positions, from its top, that some player saw a relic sent to. */
function knownRelicDeckIndexes(state: HydratedOathGameState): Set<number> {
    const size = state.requireVault().relicDeck.length
    return new Set(
        [
            state.seenRelicDeckBottom,
            ...state.players.map((player) => knownOf(player).relicDeckBottom)
        ].flatMap((known) =>
            known.flatMap((cardId, index) => (cardId === null ? [] : [size - known.length + index]))
        )
    )
}

function knownOf(player: HydratedOathPlayerState) {
    const { knownWorldDeckTop, knownWorldDeckBottom, knownDiscardPiles, knownRelicDeckBottom } =
        player
    assertExists(knownWorldDeckTop, 'Host View exploration requires every player’s knowledge')
    assertExists(knownWorldDeckBottom, 'Host View exploration requires every player’s knowledge')
    assertExists(knownDiscardPiles, 'Host View exploration requires every player’s knowledge')
    assertExists(knownRelicDeckBottom, 'Host View exploration requires every player’s knowledge')
    return {
        worldDeckTop: knownWorldDeckTop,
        worldDeckBottom: knownWorldDeckBottom,
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

/** R-6.3 — every relic slot any player, or the whole table, knows the relic in. */
function peekedRelicSlots(state: HydratedOathGameState): Set<string> {
    return new Set([
        ...Object.keys(state.seenRelics),
        ...state.players.flatMap((player) => [
            ...player.peekedRelicSlotIds,
            ...Object.keys(player.peekedRelics ?? {})
        ])
    ])
}

function peekedSiteSlots(state: HydratedOathGameState): Set<string> {
    return new Set(state.players.flatMap((player) => player.peekedSiteSlotIds))
}
