import { assert, assertExists } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'
import { Region, Suit } from '../model/oathEnums.js'
import { topBackType } from '../model/vault.js'
import { PRINTED_DENIZENS_BY_SUIT, isVision, kindOf } from '../data/cardRegistry.js'
import { FAVOR_BANK_ORDER } from '../data/favorBanks.js'
import { bySuit } from '../data/typedData.js'
import { CIRCULATING_DENIZENS, stackWorldDeck } from '../data/worldDeck.js'
import type { ChronicleEntry } from '../model/chronicle.js'
import { chronicleOf, chronicleWinnerOf } from './chronicleChoices.js'
import { ChronicleShuffle, chronicleShuffles } from './chronicleRandom.js'
import { clearPiecesOn } from './chronicleMap.js'
import { forgetDiscardPiles, forgetWorldDeckOrder } from './knowledge.js'

/** R-8.4 — three of the winner's suit, two of the next clockwise, one of the one after. */
const ADDED_BY_SUIT = [3, 2, 1]

/** R-8.4.a, R-8.5 — six to the world deck from a heal, six to the Dispossessed. */
const SIX = 6

/**
 * R-1.19.a-H1, A-36(3) — the denizens in circulation (the world deck, the piles, the hands, the
 * advisers, the box and the map) as a chronicle leaves them: a first game's 54, less what each heal
 * from a stack under six fell short of R-8.5's six (F-8). Read from the public record alone.
 */
export function denizensInCirculation(record: readonly ChronicleEntry[]): number {
    return record.reduce(
        (total, entry) => total - (entry.added?.heal ? SIX - entry.added.heal.count : 0),
        CIRCULATING_DENIZENS
    )
}

/** R-8.4 — the Archive: every printed denizen in no zone of this game, by the suit it prints. */
export function archiveBySuit(state: HydratedOathGameState): Record<Suit, string[]> {
    const inGame = denizensInGame(state)
    return bySuit((suit) => PRINTED_DENIZENS_BY_SUIT[suit].filter((cardId) => !inGame.has(cardId)))
}

/** R-8.4.a — the Dispossessed sorted into its six suit stacks. */
export function dispossessedBySuit(state: HydratedOathGameState): Record<Suit, string[]> {
    const dispossessed = new Set(state.requireVault().dispossessed)
    return bySuit((suit) =>
        PRINTED_DENIZENS_BY_SUIT[suit].filter((cardId) => dispossessed.has(cardId))
    )
}

function denizensInGame(state: HydratedOathGameState): Set<string> {
    const vault = state.requireVault()
    const returned = state.chronicle?.returnedDenizenId
    return new Set([
        ...vault.worldDeck,
        ...Object.values(vault.discardPiles).flat(),
        ...vault.dispossessed,
        ...Object.values(state.denizensBySite).flat(),
        ...state.players.flatMap((player) => [...player.knownAdviserIds(), ...player.knownHand()]),
        ...state.boxIds,
        ...(returned !== undefined ? [returned] : [])
    ])
}

/** R-8.4 — clockwise from the winner's suit, as the favor banks lie. */
function suitsAddedFrom(suit: Suit): Suit[] {
    const at = FAVOR_BANK_ORDER.indexOf(suit)
    return ADDED_BY_SUIT.map((_, k) => FAVOR_BANK_ORDER[(at + k) % FAVOR_BANK_ORDER.length])
}

/**
 * R-8.4 — take the six at random from the Archive into the world deck, all or none: if one is
 * missing, heal the Archive instead (R-8.4.a), from the largest Dispossessed stack, and draw no
 * 3/2/1 after it. A tie for the largest is published for the winner to choose (R-8.4.a-H1).
 */
export function addSixOrHeal(state: HydratedOathGameState): void {
    const chronicle = chronicleOf(state)
    const suit = chronicle.suit
    assertExists(suit, 'R-8.4 — the suit is known before the six are added')
    const vault = state.requireVault()
    const suits = suitsAddedFrom(suit)
    const archive = archiveBySuit(state)
    if (suits.every((added, k) => archive[added].length >= ADDED_BY_SUIT[k])) {
        for (const [k, added] of suits.entries()) {
            const stack = archive[added]
            chronicleShuffles.shuffle(state, ChronicleShuffle.Archive, stack)
            vault.worldDeck.push(...stack.slice(0, ADDED_BY_SUIT[k]))
        }
        chronicle.added = { suits }
        return
    }
    const stacks = dispossessedBySuit(state)
    const count = Math.max(...FAVOR_BANK_ORDER.map((stack) => stacks[stack].length))
    const largest = FAVOR_BANK_ORDER.filter((stack) => stacks[stack].length === count)
    if (largest.length === 1) {
        healFrom(state, largest[0])
        return
    }
    // R-8.4.a-H1 — the stacks are sorted in front of everyone, so their sizes are public.
    chronicle.healTie = { suits: largest, count }
}

/** R-8.4.a-H1 — the six come from the tied stack the winner chose. */
export function healFromChosenStack(state: HydratedOathGameState): void {
    const suit = chronicleOf(state).healSuit
    assertExists(suit, 'R-8.4.a-H1 — the winner chose a stack')
    healFrom(state, suit)
}

/**
 * R-8.4.a — six at random from the stack, or all it holds (R-9.3), into the world deck; every
 * stack then goes back to its Archive stack, so the Dispossessed is empty.
 */
function healFrom(state: HydratedOathGameState, suit: Suit): void {
    const vault = state.requireVault()
    const stack = dispossessedBySuit(state)[suit]
    chronicleShuffles.shuffle(state, ChronicleShuffle.Heal, stack)
    const taken = stack.slice(0, SIX)
    vault.worldDeck.push(...taken)
    vault.dispossessed = []
    state.dispossessedCount = 0
    chronicleOf(state).added = { heal: { suit, count: taken.length } }
}

/**
 * R-8.5 — set aside all five Visions, wherever they are; shuffle every discard pile with every
 * losing player's adviser, faceup or facedown, and put six of them in the Dispossessed unseen
 * (R-9.3: as many as there are). The rest wait in the Cradle's pile for R-8.8. Returns how many.
 */
export function dispossess(state: HydratedOathGameState): number {
    const vault = state.requireVault()
    setAsideVisions(state)
    const winnerId = chronicleWinnerOf(state)
    const pool = Object.values(Region).flatMap((region) => vault.discardPiles[region])
    for (const player of state.players) {
        if (player.playerId === winnerId) continue
        const advisers = player.knownAdviserIds()
        for (const cardId of advisers) clearPiecesOn(state, cardId)
        player.setAdvisers([])
        pool.push(...advisers)
    }
    chronicleShuffles.shuffle(state, ChronicleShuffle.Dispossess, pool)
    const taken = pool.splice(0, SIX)
    vault.dispossessed.push(...taken)
    state.dispossessedCount = vault.dispossessed.length
    setPiles(state, pool)
    forgetDiscardPiles(state)
    return taken.length
}

/**
 * R-8.5, R-5.1.4.IV-H1 — every Vision leaves its zone, the box included; they wait in the world
 * deck, from which R-8.8 takes them apart from the denizens. Warbands on one go to their banks.
 */
function setAsideVisions(state: HydratedOathGameState): void {
    const vault = state.requireVault()
    const visions: string[] = []
    const without = (cardIds: readonly string[]) => {
        visions.push(...cardIds.filter(isVision))
        return cardIds.filter((cardId) => !isVision(cardId))
    }
    for (const region of Object.values(Region))
        vault.discardPiles[region] = without(vault.discardPiles[region])
    vault.dispossessed = without(vault.dispossessed)
    state.boxIds = without(state.boxIds)
    for (const player of state.players) {
        const held = player.knownAdvisers()
        const kept = held.filter((adviser) => !isVision(adviser.cardId))
        if (kept.length < held.length) player.setAdvisers(kept)
        visions.push(...held.filter((adviser) => isVision(adviser.cardId)).map((a) => a.cardId))
        if (player.revealedVisionId !== undefined) {
            visions.push(player.revealedVisionId)
            delete player.revealedVisionId
        }
    }
    for (const cardId of visions) clearPiecesOn(state, cardId)
    vault.worldDeck.push(...visions)
}

/**
 * R-8.8 — every denizen still in play, shuffled: the world deck with R-8.4's six, the denizen
 * R-8.3.1 returned, what R-8.5 left in the piles and the winner's advisers. No hand exists when a
 * game ends, and the cards at the sites stay there (R-8.7.1). Then 10 with 2 Visions, 15 with 3.
 */
export function rebuildWorldDeck(state: HydratedOathGameState): void {
    const vault = state.requireVault()
    const chronicle = chronicleOf(state)
    assert(
        state.players.every((player) => player.handCount === 0),
        'R-8.8 — no player holds a drawn card when the game ends'
    )
    const advisers = state.players.flatMap((player) => {
        const held = player.knownAdviserIds()
        for (const cardId of held) clearPiecesOn(state, cardId)
        player.setAdvisers([])
        return held
    })
    const returned = chronicle.returnedDenizenId
    delete chronicle.returnedDenizenId
    const inPlay = [
        ...vault.worldDeck,
        ...Object.values(Region).flatMap((region) => vault.discardPiles[region]),
        ...(returned !== undefined ? [returned] : []),
        ...advisers
    ]
    vault.worldDeck = stackWorldDeck(
        {
            denizenIds: inPlay.filter((cardId) => !isVision(cardId)),
            visionIds: inPlay.filter(isVision)
        },
        (cardIds) => chronicleShuffles.shuffle(state, ChronicleShuffle.Rebuild, cardIds)
    )
    setPiles(state, [])
    state.worldDeckExhausted = vault.worldDeck.length === 0
    state.topCardBackType = topBackType(vault)
    state.worldDeckVisions = vault.worldDeck.filter(isVision).length
    state.worldDeckDrawn = 0
    forgetWorldDeckOrder(state)
    forgetDiscardPiles(state)
    chronicle.rebuilt = true
}

/** R-8.5 — `cradle` is the Cradle's pile, the other piles empty; the counts and backs follow. */
function setPiles(state: HydratedOathGameState, cradle: string[]): void {
    const vault = state.requireVault()
    vault.discardPiles = {
        [Region.Cradle]: cradle,
        [Region.Provinces]: [],
        [Region.Hinterland]: []
    }
    state.discardPileCounts = {
        [Region.Cradle]: cradle.length,
        [Region.Provinces]: 0,
        [Region.Hinterland]: 0
    }
    const [top] = cradle
    state.discardTopBackType = top === undefined ? {} : { [Region.Cradle]: kindOf(top) }
}
