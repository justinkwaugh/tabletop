import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { IMPERIAL_WARBANDS, PowerChoiceKind, Suit, type LegalChoice } from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import {
    NO_OPTION,
    emptyPicks,
    openCountCeiling,
    optionIndexOf,
    picksComplete,
    powerChoicesFrom,
    withSeveralCount
} from './powerChoices.js'

const cage: LegalChoice = {
    spec: { kind: PowerChoiceKind.Warbands, min: 1, max: 16 },
    options: [
        {
            kind: PowerChoiceKind.Warbands,
            group: { at: { kind: 'board', playerId: 'red' }, owner: 'red', count: 3 }
        },
        {
            kind: PowerChoiceKind.Warbands,
            group: { at: { kind: 'board', playerId: 'chan' }, owner: IMPERIAL_WARBANDS, count: 2 }
        }
    ]
}

describe('powerChoicesFrom — a spec taking several picks', () => {
    it('sends nothing until an option is ticked', () => {
        expect(powerChoicesFrom([cage], emptyPicks())).toEqual([])
    })

    it('sends every ticked option, each with its own count, up to what it carries', () => {
        const ticked = { ...emptyPicks(), several: { 0: [1, 0] } }
        const picks = withSeveralCount(withSeveralCount(ticked, cage, 0, 0, 9), cage, 0, 1, 1)
        expect(powerChoicesFrom([cage], picks)).toEqual([
            {
                kind: PowerChoiceKind.Warbands,
                group: { at: { kind: 'board', playerId: 'chan' }, owner: IMPERIAL_WARBANDS, count: 1 }
            },
            {
                kind: PowerChoiceKind.Warbands,
                group: { at: { kind: 'board', playerId: 'red' }, owner: 'red', count: 3 }
            }
        ])
    })

    it('a ticked option with no count named sends all it carries', () => {
        const picks = { ...emptyPicks(), several: { 0: [0] } }
        expect(powerChoicesFrom([cage], picks)).toEqual([cage.options[0]])
    })
})

describe('picksComplete — a confirm shows once every spec has its least picks', () => {
    const bank: LegalChoice = {
        spec: { kind: PowerChoiceKind.FavorBank, min: 1, max: 1 },
        options: [
            { kind: PowerChoiceKind.FavorBank, suit: Suit.Arcane },
            { kind: PowerChoiceKind.FavorBank, suit: Suit.Hearth }
        ]
    }
    const maybe: LegalChoice = { ...bank, spec: { ...bank.spec, min: 0 } }

    it('a spec taking several picks waits for its least', () => {
        expect(picksComplete([cage], emptyPicks())).toBe(false)
        expect(picksComplete([cage], { ...emptyPicks(), several: { 0: [1] } })).toBe(true)
    })

    it('a required single pick waits for a pick unless it has one option; an optional one is complete with none', () => {
        expect(picksComplete([bank], emptyPicks())).toBe(false)
        expect(picksComplete([bank], { ...emptyPicks(), option: { 0: 1 } })).toBe(true)
        expect(picksComplete([bank], { ...emptyPicks(), option: { 0: NO_OPTION } })).toBe(false)
        expect(picksComplete([{ ...bank, options: [bank.options[1]] }], emptyPicks())).toBe(true)
        expect(picksComplete([maybe], emptyPicks())).toBe(true)
        expect(picksComplete([{ ...bank, options: [] }], emptyPicks())).toBe(false)
    })
})

describe('optionIndexOf — no default where the player has a choice', () => {
    const one: LegalChoice = { spec: { ...cage.spec, max: 1 }, options: cage.options }

    it('a required single pick starts with nothing picked', () => {
        expect(optionIndexOf(one, 0, emptyPicks())).toBe(NO_OPTION)
        expect(powerChoicesFrom([one], emptyPicks())).toEqual([])
    })

    it('a required single pick with one legal option starts on it', () => {
        const only: LegalChoice = { ...one, options: [cage.options[1]] }
        expect(optionIndexOf(only, 0, emptyPicks())).toBe(0)
        expect(powerChoicesFrom([only], emptyPicks())).toEqual([cage.options[1]])
    })

    it('an optional single pick starts with nothing picked, even with one option', () => {
        const maybe: LegalChoice = { spec: { ...one.spec, min: 0 }, options: [cage.options[0]] }
        expect(optionIndexOf(maybe, 0, emptyPicks())).toBe(NO_OPTION)
    })

    it('a pick made is kept', () => {
        expect(optionIndexOf(one, 0, { ...emptyPicks(), option: { 0: 1 } })).toBe(1)
        expect(powerChoicesFrom([one], { ...emptyPicks(), option: { 0: 1 } })).toEqual([
            cage.options[1]
        ])
    })
})

describe('openCountCeiling — how far an open count runs (Witch\'s Bargain)', () => {
    const holding = (advisers: string[]) => {
        const state = testState([
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                favor: 0,
                secrets: 3,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            })
        ])
        state.favorBank[Suit.Nomad] = 8
        return state
    }

    it('stops at the secrets or the favor on the board, whichever is more', () => {
        expect(openCountCeiling(holding([]), 'me')).toBe(3)
    })

    it('R-7.1.2 — counts the favor Vow of Kinship keeps in the nomad bank', () => {
        expect(openCountCeiling(holding(['denizen.nomad.vow-of-kinship']), 'me')).toBe(8)
    })

    it('offers nothing to a viewer with no seat', () => {
        expect(openCountCeiling(holding([]), undefined)).toBe(0)
    })
})
