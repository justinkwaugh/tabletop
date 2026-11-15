import { describe, expect, it } from 'vitest'
import { Suit } from '@tabletop/oath'
import { tokenParts } from './tokenText.js'
import { namedWarbandOwner } from './actionDescription.js'

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
        // Small Friends' line in its menu row.
        expect(tokenParts('cards at beast sites')).toEqual([
            text('cards at '),
            { kind: 'suit', suit: Suit.Beast, bank: false },
            text(' sites')
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

describe('History text, which draws warbands too', () => {
    const history = (t: string) => tokenParts(t, { warbands: true })

    it('draws a counted warband as its token, keeping the words for its alt', () => {
        expect(history('killed a warband at the Plains')).toEqual([
            text('killed '),
            { kind: 'warband', count: 1, whose: { kind: 'row' }, words: 'warband' },
            text(' at the Plains')
        ])
    })

    it('R-10.13 — warbands on a seat’s board, or lost by a seat, are held as that seat’s own', () => {
        expect(history('killed a warband on your board')).toEqual([
            text('killed '),
            { kind: 'warband', count: 1, whose: { kind: 'held', name: 'your' }, words: 'warband' },
            text(' on your board')
        ])
        expect(history("killed 1 warband on Dana's board (Bear Traps)")).toEqual([
            text('killed '),
            { kind: 'warband', count: 1, whose: { kind: 'held', name: 'Dana' }, words: 'warband' },
            text(" on Dana's board (Bear Traps)")
        ])
        expect(history('9 swords against 9 defense; Dana lost 2 warbands to skulls')).toEqual([
            text('9 swords against 9 defense; Dana lost '),
            { kind: 'warband', count: 2, whose: { kind: 'held', name: 'Dana' }, words: 'warbands' },
            text(' to skulls')
        ])
        expect(history('lost 2 warbands to skulls')).toEqual([
            text('lost '),
            { kind: 'warband', count: 2, whose: { kind: 'row' }, words: 'warbands' },
            text(' to skulls')
        ])
    })

    it('R-10.13 — a seat id that begins with "-" or "_" is the whole loser', () => {
        for (const id of ['-aB3xQ', '_aB3xQ']) {
            expect(history(`9 swords against 9 defense; ${id} lost 2 warbands to skulls`)).toEqual([
                text(`9 swords against 9 defense; ${id} lost `),
                { kind: 'warband', count: 2, whose: { kind: 'held', name: id }, words: 'warbands' },
                text(' to skulls')
            ])
        }
    })

    it('R-10.13 — a loser whose seat id begins with "-" holds that seat’s own warbands', () => {
        const [, lost] = history('9 swords against 9 defense; -aB3xQ lost 2 warbands to skulls')
        const reader = {
            names: { player: (id: string) => id, seats: ['p1', '-aB3xQ'] },
            viewerId: undefined
        }
        const ownWarbandsOf = (id: string) => (id === '-aB3xQ' ? 'imperial' : id)
        expect(
            lost.kind === 'warband' && namedWarbandOwner(lost.whose, 'p1', reader, ownWarbandsOf)
        ).toBe('imperial')
    })

    it('marks the Empire’s warbands, and swallows a named owner into the token', () => {
        expect(history('moved 2 Imperial warbands to you')).toEqual([
            text('moved '),
            { kind: 'warband', count: 2, whose: { kind: 'imperial' }, words: 'Imperial warbands' },
            text(' to you')
        ])
        expect(history("moved 3 of Bob's warbands to the Plains")).toEqual([
            text('moved '),
            {
                kind: 'warband',
                count: 3,
                whose: { kind: 'seat', name: 'Bob' },
                words: "of Bob's warbands"
            },
            text(' to the Plains')
        ])
    })

    it('R-10.13 — a phrase names its own owner: the viewer’s "your", the actor’s "their own"', () => {
        expect(history('gained 1 of your own warbands')).toEqual([
            text('gained '),
            { kind: 'warband', count: 1, whose: { kind: 'viewer' }, words: 'of your own warbands' }
        ])
        expect(history('3 of your warbands went back to your bank')).toEqual([
            { kind: 'warband', count: 3, whose: { kind: 'viewer' }, words: 'of your warbands' },
            text(' went back to your bank')
        ])
        expect(history('gained 3 of their own warbands')).toEqual([
            text('gained '),
            { kind: 'warband', count: 3, whose: { kind: 'actor' }, words: 'of their own warbands' }
        ])
    })

    it('R-10.13 — a row with several owners gives each phrase its own', () => {
        expect(history("moved 2 of Cass's warbands and 2 Imperial warbands from the Cage")).toEqual(
            [
                text('moved '),
                {
                    kind: 'warband',
                    count: 2,
                    whose: { kind: 'seat', name: 'Cass' },
                    words: "of Cass's warbands"
                },
                text(' and '),
                {
                    kind: 'warband',
                    count: 2,
                    whose: { kind: 'imperial' },
                    words: 'Imperial warbands'
                },
                text(' from the Cage')
            ]
        )
    })

    it('leaves an uncounted mention as words', () => {
        expect(history('let Bob move the warbands')).toEqual([text('let Bob move the warbands')])
    })

    it('leaves warbands as words in the panels', () => {
        expect(tokenParts('get 2 warbands')).toEqual([text('get 2 warbands')])
    })
    it('keeps a card’s name whole, though it holds a token’s word', () => {
        expect(tokenParts('used A Small Favor, placing a favor on it')).toEqual([
            text('used A Small Favor, placing '),
            { kind: 'favor', count: 1 },
            text(' on it')
        ])
        expect(
            tokenParts('mustered at Secret Police, gaining 2 warbands', { warbands: true })
        ).toEqual([
            text('mustered at Secret Police, gaining '),
            { kind: 'warband', count: 2, whose: { kind: 'row' }, words: 'warbands' }
        ])
        expect(tokenParts('used Secret Signal: gained a secret')).toEqual([
            text('used Secret Signal: gained '),
            { kind: 'secret', count: 1 }
        ])
    })
})

describe('the skull as its symbol, in the rows that ask for it', () => {
    it('draws "skull" and "skulls" as the skull, the word its alt; the count stays words', () => {
        expect(
            tokenParts('Dana lost 1 warband to a skull', { warbands: true, skulls: true })
        ).toEqual([
            text('Dana lost '),
            { kind: 'warband', count: 1, whose: { kind: 'held', name: 'Dana' }, words: 'warband' },
            text(' to a '),
            { kind: 'skull', words: 'skull' }
        ])
        expect(tokenParts('lost 2 warbands to skulls', { skulls: true })).toEqual([
            text('lost 2 warbands to '),
            { kind: 'skull', words: 'skulls' }
        ])
    })

    it('leaves the word alone unless asked, and never draws a word that only contains it', () => {
        expect(tokenParts('lost 1 warband to skulls', { warbands: true })).toEqual([
            text('lost '),
            { kind: 'warband', count: 1, whose: { kind: 'row' }, words: 'warband' },
            text(' to skulls')
        ])
        expect(tokenParts('the skullcap', { skulls: true })).toEqual([text('the skullcap')])
    })
})
