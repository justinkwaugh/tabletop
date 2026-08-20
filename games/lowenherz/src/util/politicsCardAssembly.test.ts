import { describe, expect, it } from 'vitest'
import { Prng } from '@tabletop/common'
import { PoliticsCardDeck } from '../definition/politicsCards.js'
import { dealPoliticsCardPiles } from './politicsCardAssembly.js'

describe('dealPoliticsCardPiles', () => {
    it('deals every card in the deck across the two piles exactly once', () => {
        const { politicsCardPileA, politicsCardPileB } = dealPoliticsCardPiles(new Prng({ seed: 1, invocations: 0 }))

        const allIds = [...politicsCardPileA, ...politicsCardPileB].map((c) => c.id)
        expect(allIds.length).toBe(PoliticsCardDeck.length)
        expect(new Set(allIds)).toEqual(new Set(PoliticsCardDeck.map((c) => c.id)))
    })

    it('splits the odd-sized deck into piles of 6 and 7, in either order', () => {
        const { politicsCardPileA, politicsCardPileB } = dealPoliticsCardPiles(new Prng({ seed: 1, invocations: 0 }))

        const sizes = [politicsCardPileA.length, politicsCardPileB.length].sort()
        expect(sizes).toEqual([6, 7])
    })

    it('is deterministic for a given seed', () => {
        const first = dealPoliticsCardPiles(new Prng({ seed: 42, invocations: 0 }))
        const second = dealPoliticsCardPiles(new Prng({ seed: 42, invocations: 0 }))

        expect(first).toEqual(second)
    })

    it('produces a different deal for a different seed', () => {
        const first = dealPoliticsCardPiles(new Prng({ seed: 1, invocations: 0 }))
        const second = dealPoliticsCardPiles(new Prng({ seed: 2, invocations: 0 }))

        expect(first).not.toEqual(second)
    })
})
