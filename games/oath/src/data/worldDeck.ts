import { shuffle, type RandomFunction } from '@tabletop/common'
import { CardKind, Suit } from '../model/oathEnums.js'
import { cardDefinition, cardIdsOfKind, kindOf, suitOf } from './cardRegistry.js'
import { bySuit } from './typedData.js'

/** R-8.8 — the top pile: 10 denizens with 2 Visions shuffled in. */
export const TOP_PILE_DENIZENS = 10
export const TOP_PILE_VISIONS = 2
/** R-8.8 — the second pile: 15 denizens with the other 3 Visions shuffled in. */
export const SECOND_PILE_DENIZENS = 15
export const SECOND_PILE_VISIONS = 3

/** R-8.5 */
export const TOTAL_VISIONS = TOP_PILE_VISIONS + SECOND_PILE_VISIONS

export const DENIZENS_PER_SUIT_IN_PLAY = 9
export const CIRCULATING_DENIZENS = DENIZENS_PER_SUIT_IN_PLAY * 6
export const CARDS_IN_PLAY = CIRCULATING_DENIZENS + TOTAL_VISIONS

/** R-9.4 — `random` is the protected stream. */
export function composeFirstGameDeck(
    random: RandomFunction,
    curated?: readonly string[]
): string[] {
    const inPlay: string[] = []

    if (curated) {
        const invalid = reasonCuratedDeckInvalid(curated)
        if (invalid) throw Error(`Curated first-game deck is not legal: ${invalid}`)
    }

    for (const suit of Object.values(Suit)) {
        const ofSuit = cardIdsOfKind(CardKind.Denizen).filter((id) => suitOf(id) === suit)
        if (ofSuit.length < DENIZENS_PER_SUIT_IN_PLAY) {
            throw Error(
                `A first game puts ${DENIZENS_PER_SUIT_IN_PLAY} denizens of each suit in ` +
                    `play; the ${suit} shard holds ${ofSuit.length}`
            )
        }
        // Shuffled in both variants so Curated consumes the vault prng exactly as Randomized does.
        shuffle(ofSuit, random)
        if (curated) {
            const chosen = new Set(curated.filter((id) => suitOf(id) === suit))
            inPlay.push(...ofSuit.filter((id) => chosen.has(id)))
            continue
        }
        inPlay.push(...ofSuit.slice(0, DENIZENS_PER_SUIT_IN_PLAY))
    }

    return composeWorldDeck(random, {
        denizenIds: inPlay,
        visionIds: cardIdsOfKind(CardKind.Vision)
    })
}

export enum SetupVariant {
    Randomized = 'randomized',
    /** `PLAYTEST_DECK` pins the composition; the order still comes from the vault seed. */
    Curated = 'curated'
}

/** R-8.8 — top card first; `random` is the protected stream (R-9.4). */
export function composeWorldDeck(random: RandomFunction, pool?: WorldDeckPool): string[] {
    const { denizenIds, visionIds } = pool ?? defaultWorldDeckPool()

    const denizens = [...denizenIds]
    const visions = [...visionIds]
    shuffle(denizens, random)
    shuffle(visions, random)

    if (visions.length !== TOTAL_VISIONS) {
        throw Error(`R-8.5 fixes the Vision count at ${TOTAL_VISIONS}; found ${visions.length}`)
    }
    if (denizens.length < TOP_PILE_DENIZENS + SECOND_PILE_DENIZENS) {
        throw Error(
            `R-8.8 needs at least ${TOP_PILE_DENIZENS + SECOND_PILE_DENIZENS} denizens; ` +
                `found ${denizens.length}`
        )
    }

    const topPile = [
        ...denizens.splice(0, TOP_PILE_DENIZENS),
        ...visions.splice(0, TOP_PILE_VISIONS)
    ]
    const secondPile = [
        ...denizens.splice(0, SECOND_PILE_DENIZENS),
        ...visions.splice(0, SECOND_PILE_VISIONS)
    ]
    shuffle(topPile, random)
    shuffle(secondPile, random)

    return [...topPile, ...secondPile, ...denizens]
}

export interface WorldDeckPool {
    denizenIds: string[]
    visionIds: string[]
}

export function defaultWorldDeckPool(): WorldDeckPool {
    return {
        denizenIds: cardIdsOfKind(CardKind.Denizen),
        visionIds: cardIdsOfKind(CardKind.Vision)
    }
}

/** Setup draws from the bottom (R-1.19, R-1.20), and never draws a Vision. */
export function visionFreeTailLength(deck: string[]): number {
    let n = 0
    for (let i = deck.length - 1; i >= 0; i--) {
        if (deck[i].startsWith(`${CardKind.Vision}.`)) break
        n++
    }
    return n
}

export function setupDrawTotal(playerCount: number): number {
    return SETUP_DISCARD_SEED_CARDS + SETUP_HAND_SIZE * playerCount
}

/** R-1.19 */
export const SETUP_DISCARD_SEED_CARDS = 3
/** R-1.20 */
export const SETUP_HAND_SIZE = 3

export function reasonCuratedDeckInvalid(ids: readonly string[]): string | undefined {
    const seen = new Set<string>()
    const perSuit = bySuit(() => 0)
    for (const id of ids) {
        if (seen.has(id)) return `${id} appears twice`
        seen.add(id)
        // `kindOf` reads the id's prefix, so a mistyped id still needs the registry check.
        if (!cardDefinition(id) || kindOf(id) !== CardKind.Denizen) {
            return `${id} is not a registered denizen`
        }
        const suit = suitOf(id)
        if (!suit) return `${id} has no suit`
        perSuit[suit] += 1
    }
    for (const suit of Object.values(Suit)) {
        if (perSuit[suit] !== DENIZENS_PER_SUIT_IN_PLAY) {
            return `${suit} has ${perSuit[suit]} denizens; a first game needs ${DENIZENS_PER_SUIT_IN_PLAY}`
        }
    }
    return undefined
}
