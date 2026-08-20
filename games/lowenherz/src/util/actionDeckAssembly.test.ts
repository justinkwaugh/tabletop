import { describe, expect, it } from 'vitest'
import { Prng } from '@tabletop/common'
import { assembleActionDeck, assembleActionDeckWithConstruction } from './actionDeckAssembly.js'
import { ActionCardType, CardBack } from '../definition/actionCards.js'

describe('assembleActionDeck', () => {
    it('drops the A cards and keeps the B/C/D/E composition (25 cards)', () => {
        const deck = assembleActionDeck(new Prng({ seed: 1, invocations: 0 }))

        expect(deck.length).toBe(25)
        expect(deck.every((card) => card.back !== CardBack.A)).toBe(true)

        const counts: Record<string, number> = {}
        for (const card of deck) counts[card.back] = (counts[card.back] ?? 0) + 1
        expect(counts).toEqual({ B: 7, C: 7, D: 7, E: 4 })
    })

    it('stacks the groups in B, C, D, E draw order', () => {
        const deck = assembleActionDeck(new Prng({ seed: 1, invocations: 0 }))
        const backs = deck.map((card) => card.back)

        // Once a group starts, every card of an earlier group must already be done -
        // i.e. the sequence of first-occurrences of each letter follows B, C, D, E.
        const firstSeen = [CardBack.B, CardBack.C, CardBack.D, CardBack.E].map((back) =>
            backs.indexOf(back)
        )
        expect(firstSeen).toEqual([...firstSeen].sort((a, b) => a - b))

        const lastB = backs.lastIndexOf(CardBack.B)
        const firstC = backs.indexOf(CardBack.C)
        const lastC = backs.lastIndexOf(CardBack.C)
        const firstD = backs.indexOf(CardBack.D)
        const lastD = backs.lastIndexOf(CardBack.D)
        const firstE = backs.indexOf(CardBack.E)

        expect(lastB).toBeLessThan(firstC)
        expect(lastC).toBeLessThan(firstD)
        expect(lastD).toBeLessThan(firstE)
    })

    it('contains exactly one mining card per lettered group and one King is Dead card', () => {
        const deck = assembleActionDeck(new Prng({ seed: 1, invocations: 0 }))

        const miningBacks = deck
            .filter((card) => card.type === ActionCardType.Mining)
            .map((card) => card.back)
        expect(new Set(miningBacks)).toEqual(new Set([CardBack.B, CardBack.C, CardBack.D]))

        const kingIsDeadCards = deck.filter((card) => card.type === ActionCardType.KingIsDead)
        expect(kingIsDeadCards.length).toBe(1)
        expect(kingIsDeadCards[0].back).toBe(CardBack.E)
    })

    it('is deterministic for a given seed but varies across seeds', () => {
        const deckA = assembleActionDeck(new Prng({ seed: 42, invocations: 0 }))
        const deckB = assembleActionDeck(new Prng({ seed: 42, invocations: 0 }))
        expect(deckA.map((c) => c.id)).toEqual(deckB.map((c) => c.id))

        const deckC = assembleActionDeck(new Prng({ seed: 43, invocations: 0 }))
        expect(deckC.map((c) => c.id)).not.toEqual(deckA.map((c) => c.id))
    })
})

describe('assembleActionDeckWithConstruction', () => {
    it('stacks all 6 A cards on top of the same B/C/D/E composition (31 cards)', () => {
        const deck = assembleActionDeckWithConstruction(new Prng({ seed: 1, invocations: 0 }))

        expect(deck.length).toBe(31)
        expect(deck.slice(0, 6).every((card) => card.back === CardBack.A)).toBe(true)
        expect(deck.slice(6).every((card) => card.back !== CardBack.A)).toBe(true)

        const counts: Record<string, number> = {}
        for (const card of deck) counts[card.back] = (counts[card.back] ?? 0) + 1
        expect(counts).toEqual({ A: 6, B: 7, C: 7, D: 7, E: 4 })
    })

    it('is deterministic for a given seed but varies across seeds', () => {
        const deckA = assembleActionDeckWithConstruction(new Prng({ seed: 42, invocations: 0 }))
        const deckB = assembleActionDeckWithConstruction(new Prng({ seed: 42, invocations: 0 }))
        expect(deckA.map((c) => c.id)).toEqual(deckB.map((c) => c.id))

        const deckC = assembleActionDeckWithConstruction(new Prng({ seed: 43, invocations: 0 }))
        expect(deckC.map((c) => c.id)).not.toEqual(deckA.map((c) => c.id))
    })
})
