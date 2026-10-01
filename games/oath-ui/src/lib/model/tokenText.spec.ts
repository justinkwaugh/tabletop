import { describe, expect, it } from 'vitest'
import { Suit } from '@tabletop/oath'
import { tokenParts } from './tokenText.js'

const text = (t: string) => ({ kind: 'text', text: t })

describe('panel text as tokens and symbols', () => {
    it('draws favor and secrets as tokens, with their counts', () => {
        expect(tokenParts('pay 2 favor, get 3 secrets')).toEqual([
            text('pay '),
            { kind: 'favor', count: 2 },
            text(', get '),
            { kind: 'secret', count: 3 }
        ])
    })

    it('reads "a" and "one" as a count of one', () => {
        expect(tokenParts('give a favor, flip one secret')).toEqual([
            text('give '),
            { kind: 'favor', count: 1 },
            text(', flip '),
            { kind: 'secret', count: 1 }
        ])
    })

    it('draws an uncounted favor or secret as the token alone', () => {
        expect(tokenParts('Council Seat already has favor or secrets on it')).toEqual([
            text('Council Seat already has '),
            { kind: 'favor', count: undefined },
            text(' or '),
            { kind: 'secret', count: undefined },
            text(' on it')
        ])
    })

    it('draws a named bank or a suit of cards as its symbol', () => {
        expect(tokenParts('take 1 favor from the Hearth bank')).toEqual([
            text('take '),
            { kind: 'favor', count: 1 },
            text(' from '),
            { kind: 'suit', suit: Suit.Hearth, bank: true }
        ])
        expect(tokenParts('no faceup Discord adviser')).toEqual([
            text('no faceup '),
            { kind: 'suit', suit: Suit.Discord, bank: false },
            text(' adviser')
        ])
    })

    it("keeps the banners' names and the word order as words", () => {
        expect(tokenParts("the People's Favor and the Darkest Secret")).toEqual([
            text("the People's Favor and the Darkest Secret")
        ])
        expect(tokenParts('the War Exhaustion order')).toEqual([text('the War Exhaustion order')])
    })

    it('leaves text with nothing to draw as it was', () => {
        expect(tokenParts('Choose a destination on the map.')).toEqual([
            text('Choose a destination on the map.')
        ])
    })
})
