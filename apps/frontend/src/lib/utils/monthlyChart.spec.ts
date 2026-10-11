import { describe, expect, it } from 'vitest'
import { monthsThrough } from './gameStats'
import { monthlyChart } from './monthlyChart'

describe('monthly games chart', () => {
    it('scales columns to a rounded axis and separates won from lost games', () => {
        const months = ['2026-01', '2026-02', '2026-03', '2026-04']
        const chart = monthlyChart(
            [
                { month: '2026-01', plays: 9, wonOrTied: 3 },
                { month: '2026-03', plays: 2, wonOrTied: 2 },
                { month: '2026-04', plays: 1, wonOrTied: 0 }
            ],
            months,
            422,
            126
        )
        expect(chart.gridlines.map((line) => line.value)).toEqual([0, 2, 4, 6, 8, 10])
        expect(chart.plotBottom).toBe(106)
        expect(chart.gridlines.map((line) => line.y)).toEqual([106, 86, 66, 46, 26, 6])
        expect(chart.slotWidth).toBe(100)

        const [mixed, empty, allWon, allLost] = chart.columns
        expect(mixed.topY).toBe(16)
        expect(mixed.wonOrTiedPath).toContain('V76')
        expect(mixed.lostPath).toContain('V74Z')
        expect(empty).toMatchObject({ plays: 0, wonOrTiedPath: undefined, lostPath: undefined })
        expect(allWon.lostPath).toBeUndefined()
        expect(allWon.wonOrTiedPath).toContain('V106Z')
        expect(allLost.wonOrTiedPath).toBeUndefined()
        expect(allLost.lostPath).toContain('V106Z')
        expect(chart.columns.map((column) => column.centerX)).toEqual([72, 172, 272, 372])
    })

    it('keeps the axis readable for busy months and labels only as many months as fit', () => {
        const months = monthsThrough('2024-01', '2026-12')
        const chart = monthlyChart(
            [{ month: '2025-06', plays: 130, wonOrTied: 60 }],
            months,
            350,
            200
        )
        expect(chart.gridlines.map((line) => line.value)).toEqual([0, 50, 100, 150])
        const labels = chart.columns.flatMap((column) => column.label ?? [])
        expect(labels).toHaveLength(5)
        expect(labels.at(-1)).toBe('Dec 26')
    })
})
