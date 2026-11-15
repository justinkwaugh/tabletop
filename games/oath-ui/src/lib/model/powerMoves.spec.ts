import { describe, expect, it } from 'vitest'
import { PowerChoiceKind, one, optional, type LegalChoice } from '@tabletop/oath'
import {
    isPowerMoves,
    moveChoices,
    withCount,
    withFrom,
    withTo,
    type MoveFrom
} from './powerMoves.js'

const site: MoveFrom = { at: { kind: 'site', siteId: 'c1' }, owner: 'me' }
const board: MoveFrom = { at: { kind: 'board', playerId: 'me' }, owner: 'me' }

describe('a power’s moves', () => {
    it('are pairs of warbands and a site, each read on the state the choices before leave', () => {
        const pair = (sequential: boolean): LegalChoice[] => [
            {
                spec: one(PowerChoiceKind.Warbands, sequential ? { sequential: true } : {}),
                options: []
            },
            {
                spec: optional(PowerChoiceKind.Site, sequential ? { sequential: true } : {}),
                options: []
            }
        ]
        expect(isPowerMoves([...pair(true), ...pair(true)])).toBe(true)
        // A pair read on the state before the power (Warning Signals' before its moves were paired).
        expect(isPowerMoves(pair(false))).toBe(false)
        expect(isPowerMoves([])).toBe(false)
    })

    it('How many is the warband pieces: a tap on the Nth sets N, a tap on the current count clears it', () => {
        expect(withCount([{ from: site }], 0, undefined, 2)).toEqual([{ from: site, count: 2 }])
        expect(withCount([{ from: site, count: 2 }], 0, 2, 3)).toEqual([{ from: site, count: 3 }])
        expect(withCount([{ from: site, count: 2 }], 0, 2, 2)).toEqual([
            { from: site, count: undefined }
        ])
    })

    it('a From made because it has one option is not kept with the count or the To', () => {
        const counted = withCount([], 0, undefined, 2)
        expect(counted).toEqual([{ count: 2 }])
        const sent = withTo([], 0, { kind: 'board' })
        expect(sent).toEqual([{ to: { kind: 'board' } }])
        expect(withTo(counted, 0, { kind: 'board' })).toEqual([{ count: 2, to: { kind: 'board' } }])
    })

    it('a count made because it has one option is not kept with the To', () => {
        const picks = withTo([{ from: site }], 0, { kind: 'board' })
        expect(picks).toEqual([{ from: site, to: { kind: 'board' } }])
        expect(picks[0]).not.toHaveProperty('count')
    })

    it('a move made from no pick keeps its place: a tap on a later move lands on that move', () => {
        const to = { kind: 'site' as const, siteId: 'c2' }
        expect(withFrom([], 1, board)).toEqual([{}, { from: board }])
        expect(withCount([{}, { from: board }], 1, undefined, 2)).toEqual([
            {},
            { from: board, count: 2 }
        ])
        expect(withTo([{}, { from: board }], 1, to)).toEqual([{}, { from: board, to }])
        expect(withTo([{}, { from: board, count: 2 }], 1, to)).toEqual([
            {},
            { from: board, count: 2, to }
        ])
        // Clearing that From leaves nothing behind.
        expect(withFrom([{}, { from: board }], 1, board)).toEqual([])
    })

    it('a tap on the picked From clears the move; another From starts it again', () => {
        const whole = { from: board, count: 1, to: { kind: 'site' as const, siteId: 'c2' } }
        expect(withFrom([whole, { from: site, count: 1 }], 1, site)).toEqual([whole])
        expect(withFrom([whole, { from: site, count: 1 }], 1, board)).toEqual([
            whole,
            { from: board }
        ])
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
