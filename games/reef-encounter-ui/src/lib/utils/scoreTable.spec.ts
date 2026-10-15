import { describe, expect, it } from 'vitest'
import { CoralColor, coralCounts, type ScoreBreakdown } from '@tabletop/reef-encounter'
import { scoreTable } from './scoreTable.js'

const score = (
    polyps: Partial<Record<CoralColor, number>>,
    extra: Partial<ScoreBreakdown> = {}
): ScoreBreakdown => {
    const parrotfishPolyps = { ...coralCounts(0), ...polyps }
    return {
        parrotfishPolyps,
        total: Object.values(parrotfishPolyps).reduce((sum, count) => sum + count * 2, 0),
        consumedPolyps: 0,
        larvaCubes: 0,
        supplyPolyps: 0,
        guardedPolyps: 0,
        ...extra
    }
}
const values = coralCounts(2)

describe('the end-of-game score table', () => {
    it('ranks players by total, with each colour scored at its value', () => {
        const table = scoreTable(
            { a: score({ pink: 1 }), b: score({ grey: 3, white: 1 }) },
            values,
            ['a', 'b']
        )
        expect(table.rows.map((row) => [row.playerId, row.place, row.total])).toEqual([
            ['b', 1, 8],
            ['a', 2, 2]
        ])
        expect(table.rows[0].cells.find((cell) => cell.color === CoralColor.Grey)).toEqual({
            color: CoralColor.Grey,
            polyps: 3,
            points: 6
        })
        expect(table.tieBreaks).toEqual([])
    })

    it('names the tie-break that separates equal totals', () => {
        const table = scoreTable(
            {
                a: score({ pink: 2 }, { consumedPolyps: 1 }),
                b: score({ white: 2 }, { consumedPolyps: 3 })
            },
            values,
            ['a', 'b']
        )
        expect(table.rows.map((row) => [row.playerId, row.place])).toEqual([
            ['b', 1],
            ['a', 2]
        ])
        expect(table.tieBreaks).toEqual([
            { aheadId: 'b', behindId: 'a', criterion: 'consumed polyps', ahead: 3, behind: 1 }
        ])
    })

    it('shares a place when every tie-break is level', () => {
        const table = scoreTable({ a: score({ pink: 1 }), b: score({ grey: 1 }) }, values, [
            'a',
            'b'
        ])
        expect(table.rows.map((row) => row.place)).toEqual([1, 1])
        expect(table.tieBreaks).toEqual([])
    })
})
