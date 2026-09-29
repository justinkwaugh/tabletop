import { afterEach, describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Suit } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { cardPowers } from '../data/cardPowers.js'
import {
    declareChoices,
    legalChoices,
    one,
    optional,
    PowerChoiceKind,
    reasonChoicesInvalid,
    type PowerChoice
} from './powerChoice.js'

const CAPTAINS = cardPowers('denizen.order.captains')[0]

function board() {
    return testState(
        [
            testPlayer({
                playerId: 'p1',
                color: Color.Red,
                siteId: 'c1',
                advisers: [{ cardId: 'denizen.beast.rangers', faceUp: true }],
                warbandsOnBoard: { [Color.Red]: 3 }
            }),
            testPlayer({ playerId: 'p2', color: Color.Blue, siteId: 'c2' }),
            testPlayer({ playerId: 'p3', color: Color.Yellow, siteId: 'c1' })
        ],
        {
            denizensBySite: { c1: ['denizen.order.captains', 'denizen.hearth.ballot-box'] },
            warbandsBySite: { c1: { [Color.Red]: 1 } },
            siteCards: { c1: 'site.mine', c2: 'site.river', p1: 'site.plains' }
        }
    )
}

afterEach(() => declareChoices(CAPTAINS.cardId, CAPTAINS.powerIndex, []))

describe('a power that declares no choices', () => {
    it('accepts none and refuses any', () => {
        const state = board()
        expect(reasonChoicesInvalid(state, 'p1', CAPTAINS, undefined)).toBeUndefined()
        expect(reasonChoicesInvalid(state, 'p1', CAPTAINS, [])).toBeUndefined()
        expect(
            reasonChoicesInvalid(state, 'p1', CAPTAINS, [{ kind: PowerChoiceKind.Yes }])
        ).toMatch(/takes no choices, but 1 were given/)
        expect(legalChoices(state, 'p1', CAPTAINS)).toEqual([])
    })
})

describe('counts — "no choice was made" and "two given where one was wanted"', () => {
    it('a required choice missing is refused by name', () => {
        declareChoices(CAPTAINS.cardId, 0, [one(PowerChoiceKind.FavorBank, { what: 'a favor bank' })])
        expect(reasonChoicesInvalid(board(), 'p1', CAPTAINS, [])).toBe(
            'no choice was made for a favor bank'
        )
    })

    it('a surplus is refused against the max', () => {
        declareChoices(CAPTAINS.cardId, 0, [one(PowerChoiceKind.FavorBank, { what: 'a favor bank' })])
        const two: PowerChoice[] = [
            { kind: PowerChoiceKind.FavorBank, suit: Suit.Beast },
            { kind: PowerChoiceKind.FavorBank, suit: Suit.Nomad }
        ]
        expect(reasonChoicesInvalid(board(), 'p1', CAPTAINS, two)).toBe(
            '2 given where at most 1 of a favor bank were wanted'
        )
    })

    it('an optional spec (the bare "may") may be left empty', () => {
        declareChoices(CAPTAINS.cardId, 0, [optional(PowerChoiceKind.Yes)])
        expect(reasonChoicesInvalid(board(), 'p1', CAPTAINS, [])).toBeUndefined()
        expect(
            reasonChoicesInvalid(board(), 'p1', CAPTAINS, [{ kind: PowerChoiceKind.Yes }])
        ).toBeUndefined()
    })

    it('a kind the power never asked for is refused', () => {
        declareChoices(CAPTAINS.cardId, 0, [one(PowerChoiceKind.FavorBank)])
        const choices: PowerChoice[] = [
            { kind: PowerChoiceKind.FavorBank, suit: Suit.Beast },
            { kind: PowerChoiceKind.Site, siteId: 'c1' }
        ]
        expect(reasonChoicesInvalid(board(), 'p1', CAPTAINS, choices)).toMatch(
            /a site choice was given that .* never asked for/
        )
    })
})

describe('"that bank is not among the options" — validated against the live board', () => {
    it('favorBank: a real suit is an option, a duplicate is refused', () => {
        declareChoices(CAPTAINS.cardId, 0, [
            { kind: PowerChoiceKind.FavorBank, min: 1, max: 2, what: 'favor banks' }
        ])
        const state = board()
        expect(
            reasonChoicesInvalid(state, 'p1', CAPTAINS, [
                { kind: PowerChoiceKind.FavorBank, suit: Suit.Beast },
                { kind: PowerChoiceKind.FavorBank, suit: Suit.Beast }
            ])
        ).toBe('the beast bank was chosen twice for favor banks')
    })

    it('a narrowed domain refuses what the wide default would admit', () => {
        declareChoices(CAPTAINS.cardId, 0, [
            one(PowerChoiceKind.FavorBank, {
                what: 'a bank holding favor',
                domain: (state) =>
                    Object.values(Suit)
                        .filter((suit) => state.favorBank[suit] > 0)
                        .map((suit) => ({ kind: PowerChoiceKind.FavorBank, suit }))
            })
        ])
        const state = board()
        state.favorBank[Suit.Arcane] = 0
        expect(
            reasonChoicesInvalid(state, 'p1', CAPTAINS, [
                { kind: PowerChoiceKind.FavorBank, suit: Suit.Arcane }
            ])
        ).toBe('the arcane bank is not among the options for a bank holding favor')
        expect(
            reasonChoicesInvalid(state, 'p1', CAPTAINS, [
                { kind: PowerChoiceKind.FavorBank, suit: Suit.Beast }
            ])
        ).toBeUndefined()
    })

    it('player: defaults to every OTHER player', () => {
        declareChoices(CAPTAINS.cardId, 0, [one(PowerChoiceKind.Player, { what: 'another player' })])
        const state = board()
        const [{ options }] = legalChoices(state, 'p1', CAPTAINS)
        expect(options.map((o) => (o.kind === PowerChoiceKind.Player ? o.playerId : undefined)).sort()).toEqual(['p2', 'p3'])
        expect(
            reasonChoicesInvalid(state, 'p1', CAPTAINS, [{ kind: PowerChoiceKind.Player, playerId: 'p1' }])
        ).toBe('p1 is not among the options for another player')
    })

    it('card: defaults to what R-7.1.1 gives access to', () => {
        declareChoices(CAPTAINS.cardId, 0, [one(PowerChoiceKind.Card, { what: 'a card' })])
        const state = board()
        const [{ options }] = legalChoices(state, 'p1', CAPTAINS)
        const ids = options.map((o) => (o.kind === PowerChoiceKind.Card ? o.cardId : undefined)).sort()
        expect(ids).toEqual(
            ['denizen.beast.rangers', 'denizen.hearth.ballot-box', 'denizen.order.captains'].sort()
        )
        expect(
            reasonChoicesInvalid(state, 'p1', CAPTAINS, [
                { kind: PowerChoiceKind.Card, cardId: 'denizen.nomad.elsewhere' }
            ])
        ).toBe('denizen.nomad.elsewhere is not among the options for a card')
    })

    it('site: defaults to faceup sites only (R-10.21)', () => {
        declareChoices(CAPTAINS.cardId, 0, [one(PowerChoiceKind.Site, { what: 'a site' })])
        const state = board()
        const [{ options }] = legalChoices(state, 'p1', CAPTAINS)
        expect(options.map((o) => (o.kind === PowerChoiceKind.Site ? o.siteId : undefined)).sort()).toEqual(['c1', 'c2', 'p1'])
        expect(
            reasonChoicesInvalid(state, 'p1', CAPTAINS, [{ kind: PowerChoiceKind.Site, siteId: 'h3' }])
        ).toBe('h3 is not among the options for a site')
    })

    it('warbands: the player picks a count up to the group offered', () => {
        declareChoices(CAPTAINS.cardId, 0, [one(PowerChoiceKind.Warbands, { what: 'warbands' })])
        const state = board()
        const [{ options }] = legalChoices(state, 'p1', CAPTAINS)
        expect(options).toEqual([
            {
                kind: PowerChoiceKind.Warbands,
                group: { at: { kind: 'board', playerId: 'p1' }, color: Color.Red, count: 3 }
            }
        ])
        const pick = (count: number): PowerChoice => ({
            kind: PowerChoiceKind.Warbands,
            group: { at: { kind: 'board', playerId: 'p1' }, color: Color.Red, count }
        })
        expect(reasonChoicesInvalid(state, 'p1', CAPTAINS, [pick(2)])).toBeUndefined()
        expect(reasonChoicesInvalid(state, 'p1', CAPTAINS, [pick(4)])).toBe(
            '4 red warbands chosen for warbands, but only 3 are there'
        )
        expect(reasonChoicesInvalid(state, 'p1', CAPTAINS, [pick(0)])).toBe(
            'at least one warband must be chosen for warbands'
        )
    })
})

describe('the declaration registry', () => {
    it('is keyed by power address, and a redeclaration replaces', () => {
        declareChoices(CAPTAINS.cardId, 0, [one(PowerChoiceKind.Yes)])
        expect(legalChoices(board(), 'p1', CAPTAINS)).toHaveLength(1)
        declareChoices(CAPTAINS.cardId, 0, [])
        expect(legalChoices(board(), 'p1', CAPTAINS)).toHaveLength(0)
    })

    it('consecutive same-kind specs each take one, so a value may repeat across them', () => {
        declareChoices(CAPTAINS.cardId, 0, [
            optional(PowerChoiceKind.FavorBank),
            optional(PowerChoiceKind.FavorBank),
            optional(PowerChoiceKind.FavorBank)
        ])
        const state = board()
        expect(
            reasonChoicesInvalid(state, 'p1', CAPTAINS, [
                { kind: PowerChoiceKind.FavorBank, suit: Suit.Beast },
                { kind: PowerChoiceKind.FavorBank, suit: Suit.Beast },
                { kind: PowerChoiceKind.FavorBank, suit: Suit.Nomad }
            ])
        ).toBeUndefined()
        expect(
            reasonChoicesInvalid(state, 'p1', CAPTAINS, [
                { kind: PowerChoiceKind.FavorBank, suit: Suit.Beast },
                { kind: PowerChoiceKind.FavorBank, suit: Suit.Beast },
                { kind: PowerChoiceKind.FavorBank, suit: Suit.Nomad },
                { kind: PowerChoiceKind.FavorBank, suit: Suit.Order }
            ])
        ).toMatch(/at most 1/)
    })

    it('two specs are taken in declaration order', () => {
        declareChoices(CAPTAINS.cardId, 0, [
            one(PowerChoiceKind.Site, { what: 'a site' }),
            one(PowerChoiceKind.Player, { what: 'a player' })
        ])
        const state = board()
        const good: PowerChoice[] = [
            { kind: PowerChoiceKind.Site, siteId: 'c1' },
            { kind: PowerChoiceKind.Player, playerId: 'p2' }
        ]
        expect(reasonChoicesInvalid(state, 'p1', CAPTAINS, good)).toBeUndefined()
        expect(reasonChoicesInvalid(state, 'p1', CAPTAINS, [...good].reverse())).toBe(
            'no choice was made for a site'
        )
    })
})
