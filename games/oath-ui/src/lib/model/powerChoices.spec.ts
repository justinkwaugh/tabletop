import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { IMPERIAL_WARBANDS, PowerChoiceKind, Suit, type LegalChoice } from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { emptyPicks, openCountCeiling, powerChoicesFrom, withSeveralCount } from './powerChoices.js'

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

describe('powerChoicesFrom — a spec taking one pick', () => {
    it('still defaults a required spec to its first option', () => {
        const one: LegalChoice = { spec: { ...cage.spec, max: 1 }, options: cage.options }
        expect(powerChoicesFrom([one], emptyPicks())).toEqual([cage.options[0]])
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
