import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { PowerChoiceKind, type LegalChoice } from '@tabletop/oath'
import { emptyPicks, powerChoicesFrom, withSeveralCount } from './powerChoices.js'

const cage: LegalChoice = {
    spec: { kind: PowerChoiceKind.Warbands, min: 1, max: 16 },
    options: [
        {
            kind: PowerChoiceKind.Warbands,
            group: { at: { kind: 'board', playerId: 'red' }, color: Color.Red, count: 3 }
        },
        {
            kind: PowerChoiceKind.Warbands,
            group: { at: { kind: 'board', playerId: 'chan' }, color: Color.Purple, count: 2 }
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
                group: { at: { kind: 'board', playerId: 'chan' }, color: Color.Purple, count: 1 }
            },
            {
                kind: PowerChoiceKind.Warbands,
                group: { at: { kind: 'board', playerId: 'red' }, color: Color.Red, count: 3 }
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
