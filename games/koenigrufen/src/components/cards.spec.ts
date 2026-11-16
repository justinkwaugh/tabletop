import { describe, expect, it } from 'vitest'
import {
    card,
    cardPoints,
    Deck,
    Face,
    isTrull,
    PackPoints,
    Suit,
    suitCardId,
    trumpId
} from './cards.js'

describe('the Tarock pack', () => {
    it('has 22 trumps and four suits of eight', () => {
        expect(Deck).toHaveLength(54)
        expect(Deck.filter((candidate) => candidate.kind === 'trump')).toHaveLength(22)
        for (const suit of Object.values(Suit)) {
            expect(
                Deck.filter((candidate) => candidate.kind === 'suit' && candidate.suit === suit)
            ).toHaveLength(8)
        }
    })

    it('ranks red pips 1 2 3 4 and black pips 10 9 8 7, high to low, below the court cards', () => {
        const strength = (id: string) => {
            const found = card(id)
            return found.kind === 'suit' ? found.strength : 0
        }
        const hearts = ['K', 'Q', 'C', 'J', '1', '2', '3', '4'].map((rank) =>
            strength(`hearts-${rank}`)
        )
        const clubs = ['K', 'Q', 'C', 'J', '10', '9', '8', '7'].map((rank) =>
            strength(`clubs-${rank}`)
        )
        expect(hearts).toEqual([...hearts].sort((a, b) => b - a))
        expect(clubs).toEqual(hearts)
    })

    it('makes the Sküs, Mond and Pagat the Trull', () => {
        expect(
            Deck.filter((candidate) => isTrull(candidate.id)).map((candidate) => candidate.id)
        ).toEqual([trumpId(1), trumpId(21), trumpId(22)])
    })
})

describe('counting card points', () => {
    it('makes the whole pack 70', () => {
        expect(cardPoints(Deck.map((candidate) => candidate.id))).toBe(PackPoints)
    })

    it('counts each three two less than its total', () => {
        expect(cardPoints([suitCardId(Suit.Hearts, Face.King), trumpId(5), trumpId(6)])).toBe(5)
        expect(cardPoints([trumpId(4), trumpId(5), trumpId(6)])).toBe(1)
    })

    it('counts one or two cards left over one less than their total', () => {
        expect(cardPoints([trumpId(4)])).toBe(0)
        expect(cardPoints([trumpId(4), trumpId(5)])).toBe(1)
        expect(cardPoints([suitCardId(Suit.Spades, Face.Queen)])).toBe(3)
    })

    it('splits the pack between two sides into 70', () => {
        const ids = Deck.map((candidate) => candidate.id)
        for (const split of [1, 2, 25, 26, 27, 40]) {
            expect(cardPoints(ids.slice(0, split)) + cardPoints(ids.slice(split))).toBe(PackPoints)
        }
    })
})
