import { describe, expect, it } from 'vitest'
import { getPrng } from '@tabletop/common'
import {
    CARDS_IN_PLAY,
    CIRCULATING_DENIZENS,
    composeFirstGameDeck,
    composeWorldDeck,
    DENIZENS_PER_SUIT_IN_PLAY,
    SECOND_PILE_DENIZENS,
    SECOND_PILE_VISIONS,
    setupDrawTotal,
    SETUP_DISCARD_SEED_CARDS,
    SETUP_HAND_SIZE,
    TOP_PILE_DENIZENS,
    TOP_PILE_VISIONS,
    TOTAL_VISIONS,
    visionFreeTailLength
} from './worldDeck.js'
import { CardKind, Suit } from '../model/oathEnums.js'
import { cardIdsOfKind, suitOf } from './cardRegistry.js'

const isVision = (id: string) => id.startsWith(`${CardKind.Vision}.`)

describe('world deck composition (R-8.8, R-1.21)', () => {
    const deck = composeWorldDeck(getPrng(20260826))

    it('R-8.5 — holds exactly five Visions', () => {
        expect(deck.filter(isVision)).toHaveLength(TOTAL_VISIONS)
    })

    it('R-8.8 — two Visions in the top 12, three in the next 18, none below', () => {
        const topPile = deck.slice(0, TOP_PILE_DENIZENS + TOP_PILE_VISIONS)
        const secondPile = deck.slice(
            TOP_PILE_DENIZENS + TOP_PILE_VISIONS,
            TOP_PILE_DENIZENS + TOP_PILE_VISIONS + SECOND_PILE_DENIZENS + SECOND_PILE_VISIONS
        )
        const tail = deck.slice(
            TOP_PILE_DENIZENS + TOP_PILE_VISIONS + SECOND_PILE_DENIZENS + SECOND_PILE_VISIONS
        )

        expect(topPile.filter(isVision)).toHaveLength(TOP_PILE_VISIONS)
        expect(secondPile.filter(isVision)).toHaveLength(SECOND_PILE_VISIONS)
        expect(tail.filter(isVision)).toHaveLength(0)
    })

    it('holds every registered denizen exactly once', () => {
        const denizens = cardIdsOfKind(CardKind.Denizen)
        expect(deck.filter((id) => !isVision(id)).sort()).toEqual([...denizens].sort())
    })

    it('R-1.19, R-1.20 — the Vision-free tail covers setup at six players', () => {
        // R-1.19, R-1.20 draw from the bottom, so the tail must cover every setup draw.
        expect(setupDrawTotal(6)).toBe(SETUP_DISCARD_SEED_CARDS + SETUP_HAND_SIZE * 6)
        expect(visionFreeTailLength(deck)).toBeGreaterThanOrEqual(setupDrawTotal(6))
    })

    it('is deterministic in the seed, and different across seeds', () => {
        expect(composeWorldDeck(getPrng(7))).toEqual(composeWorldDeck(getPrng(7)))
        expect(composeWorldDeck(getPrng(7))).not.toEqual(composeWorldDeck(getPrng(8)))
    })

    it('rejects a pool that disagrees with R-8.5’s five Visions', () => {
        expect(() =>
            composeWorldDeck(getPrng(1), {
                denizenIds: cardIdsOfKind(CardKind.Denizen),
                visionIds: ['vision.conquest']
            })
        ).toThrow(/R-8.5/)
    })
})

describe('visionFreeTailLength', () => {
    it('counts back to the deepest Vision', () => {
        expect(visionFreeTailLength(['vision.a', 'denizen.x', 'denizen.y'])).toBe(2)
        expect(visionFreeTailLength(['denizen.x', 'vision.a'])).toBe(0)
        expect(visionFreeTailLength(['denizen.x', 'denizen.y'])).toBe(2)
    })
})

describe('first-game composition (R-8.4, R-8.5, R-9.4)', () => {
    const worldDeck = composeFirstGameDeck(getPrng(20260827))
    const denizensIn = (ids: string[]) => ids.filter((id) => !isVision(id))

    it('the composition numbers, pinned as literals', () => {
        // Literals on purpose: the other cases read these constants and would move with them.
        expect(DENIZENS_PER_SUIT_IN_PLAY).toBe(9)
        expect(CIRCULATING_DENIZENS).toBe(54)
        expect(TOTAL_VISIONS).toBe(5)
        expect(CARDS_IN_PLAY).toBe(59)
    })

    it('59 cards in play: 54 denizens and the 5 Visions', () => {
        expect(worldDeck).toHaveLength(CARDS_IN_PLAY)
        expect(denizensIn(worldDeck)).toHaveLength(CIRCULATING_DENIZENS)
        expect(worldDeck.filter(isVision)).toHaveLength(TOTAL_VISIONS)
    })

    it('nine denizens of each suit in play', () => {
        for (const suit of Object.values(Suit)) {
            const inPlay = denizensIn(worldDeck).filter((id) => suitOf(id) === suit)
            expect(inPlay).toHaveLength(DENIZENS_PER_SUIT_IN_PLAY)
        }
    })

    it('every denizen in play is a registered one, none duplicated', () => {
        const all = new Set(cardIdsOfKind(CardKind.Denizen))
        expect(new Set(denizensIn(worldDeck)).size).toBe(CIRCULATING_DENIZENS)
        expect(denizensIn(worldDeck).every((id) => all.has(id))).toBe(true)
    })

    it('R-1.19, R-1.20 — the guaranteed Vision-free tail still covers a six-player setup draw', () => {
        // R-8.8 — only the denizens under the second pile are sure to be Vision-free, so the measured tail is only a floor.
        const guaranteed = CIRCULATING_DENIZENS - TOP_PILE_DENIZENS - SECOND_PILE_DENIZENS
        expect(guaranteed).toBeGreaterThanOrEqual(setupDrawTotal(6))
        expect(visionFreeTailLength(worldDeck)).toBeGreaterThanOrEqual(guaranteed)
    })

    it('R-8.8 — the structure is unchanged: 2 Visions in the top 12, 3 in the next 18', () => {
        const top = worldDeck.slice(0, TOP_PILE_DENIZENS + TOP_PILE_VISIONS)
        const second = worldDeck.slice(
            TOP_PILE_DENIZENS + TOP_PILE_VISIONS,
            TOP_PILE_DENIZENS + TOP_PILE_VISIONS + SECOND_PILE_DENIZENS + SECOND_PILE_VISIONS
        )
        expect(top.filter(isVision)).toHaveLength(TOP_PILE_VISIONS)
        expect(second.filter(isVision)).toHaveLength(SECOND_PILE_VISIONS)
    })
})
