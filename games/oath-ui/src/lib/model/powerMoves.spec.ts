import { describe, expect, it } from 'vitest'
import { PowerChoiceKind, one, optional, type LegalChoice } from '@tabletop/oath'
import {
    isPowerMoves,
    moveChoices,
    withCount,
    withFrom,
    withTo,
    withoutLastPick,
    type MoveFrom
} from './powerMoves.js'

const site: MoveFrom = { at: { kind: 'site', siteId: 'c1' }, owner: 'me' }
const board: MoveFrom = { at: { kind: 'board', playerId: 'me' }, owner: 'me' }

describe('a power’s moves', () => {
    it('are pairs of warbands and a site, each read on the state the choices before leave', () => {
        const pair = (sequential: boolean): LegalChoice[] => [
            { spec: one(PowerChoiceKind.Warbands, sequential ? { sequential: true } : {}), options: [] },
            { spec: optional(PowerChoiceKind.Site, sequential ? { sequential: true } : {}), options: [] }
        ]
        expect(isPowerMoves([...pair(true), ...pair(true)])).toBe(true)
        // Warning Signals: warbands and a site, read before the power.
        expect(isPowerMoves(pair(false))).toBe(false)
        expect(isPowerMoves([])).toBe(false)
    })

    it('How many is the warband pieces: a tap on the Nth sets N, a tap on the current count clears it', () => {
        expect(withCount([{ from: site }], 0, undefined, 2)).toEqual([{ from: site, count: 2 }])
        expect(withCount([{ from: site, count: 2 }], 0, 2, 3)).toEqual([{ from: site, count: 3 }])
        expect(withCount([{ from: site, count: 2 }], 0, 2, 2)).toEqual([{ from: site, count: undefined }])
    })

    it('a From made because it has one option is not kept: Undo from the count or the To takes the move', () => {
        const counted = withCount([], 0, undefined, 2)
        expect(counted).toEqual([{ count: 2 }])
        expect(withoutLastPick(counted)).toEqual([])
        const sent = withTo([], 0, { kind: 'board' })
        expect(sent).toEqual([{ to: { kind: 'board' } }])
        expect(withoutLastPick(sent)).toEqual([])
        expect(withTo(counted, 0, { kind: 'board' })).toEqual([{ count: 2, to: { kind: 'board' } }])
        expect(withoutLastPick(withoutLastPick([{ count: 2, to: { kind: 'board' } }]))).toEqual([])
    })

    it('a count made because it has one option is not kept: Undo takes To, then From', () => {
        const picks = withTo([{ from: site }], 0, { kind: 'board' })
        expect(picks).toEqual([{ from: site, to: { kind: 'board' } }])
        expect(picks[0]).not.toHaveProperty('count')
        expect(withoutLastPick(picks)).toEqual([{ from: site }])
        expect(withoutLastPick(withoutLastPick(picks))).toEqual([])
    })

    it('a move made from no pick keeps its place: a tap on a later move lands on that move', () => {
        const to = { kind: 'site' as const, siteId: 'c2' }
        expect(withFrom([], 1, board)).toEqual([{}, { from: board }])
        expect(withCount([{}, { from: board }], 1, undefined, 2)).toEqual([{}, { from: board, count: 2 }])
        expect(withTo([{}, { from: board }], 1, to)).toEqual([{}, { from: board, to }])
        expect(withTo([{}, { from: board, count: 2 }], 1, to)).toEqual([{}, { from: board, count: 2, to }])
        // Nothing is left behind that Undo would take back to no effect.
        expect(withFrom([{}, { from: board }], 1, board)).toEqual([])
        expect(withoutLastPick([{}, { from: board }])).toEqual([])
    })

    it('a tap on the picked From clears the move; another From starts it again', () => {
        const whole = { from: board, count: 1, to: { kind: 'site' as const, siteId: 'c2' } }
        expect(withFrom([whole, { from: site, count: 1 }], 1, site)).toEqual([whole])
        expect(withFrom([whole, { from: site, count: 1 }], 1, board)).toEqual([whole, { from: board }])
    })

    it('Undo takes back To, then How many, then From, then the move before', () => {
        const whole = { from: site, count: 2, to: { kind: 'board' as const } }
        expect(withoutLastPick([whole])).toEqual([{ from: site, count: 2 }])
        expect(withoutLastPick([{ from: site, count: 2 }])).toEqual([{ from: site }])
        expect(withoutLastPick([whole, { from: board }])).toEqual([whole])
        expect(withoutLastPick([])).toEqual([])
    })

    it('send the flat list: the warbands, then the site unless they go to the board', () => {
        expect(
            moveChoices([
                { from: site, count: 2, to: { kind: 'board' } },
                { from: board, count: 2, to: { kind: 'site', siteId: 'c2' } }
            ])
        ).toEqual([
            { kind: PowerChoiceKind.Warbands, group: { ...site, count: 2 } },
            { kind: PowerChoiceKind.Warbands, group: { ...board, count: 2 } },
            { kind: PowerChoiceKind.Site, siteId: 'c2' }
        ])
    })
})
