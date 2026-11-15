import { describe, expect, it } from 'vitest'
import { nearestRound, spreadLabels, wealthChart } from './wealthChart.js'
import type { WealthPoint } from './wealthHistory.js'

function point(label: string, wealth: Record<string, number>): WealthPoint {
    return { id: label, label, title: label, wealth }
}
const points = [
    point('Start', { a: 400, b: 400 }),
    point('Auction', { a: 380, b: 420 }),
    point('SR 1', { a: 390, b: 430 }),
    point('OR 1.1', { a: 520, b: 470 })
]
const chart = (width: number, chartPoints = points) =>
    wealthChart({
        points: chartPoints,
        playerIds: ['a', 'b'],
        width,
        height: 200,
        valueLabelWidth: (value) => 6 * String(value).length
    })

describe('wealth chart', () => {
    it('spaces rounds evenly from zero to a rounded ceiling', () => {
        const { gridlines, plotLeft, plotRight, x } = chart(400)
        expect(gridlines.map((line) => line.value)).toEqual([0, 200, 400, 600])
        expect(x(0)).toBe(plotLeft)
        expect(x(3)).toBe(plotRight)
    })
    it('draws one line per player through every round', () => {
        expect(chart(400).lines.map((line) => line.path.match(/[ML]/g)?.length)).toEqual([4, 4])
    })
    it('always labels the latest round and thins earlier ones back from it', () => {
        expect(chart(400).roundLabels.map((label) => label.label)).toEqual([
            'Start',
            'Auction',
            'SR 1',
            'OR 1.1'
        ])
        expect(chart(140).roundLabels.map((label) => label.label)).toEqual(['Auction', 'OR 1.1'])
    })
    it('extends below zero for negative wealth', () => {
        const negative = [point('Start', { a: 100, b: 100 }), point('SR 1', { a: -150, b: 300 })]
        expect(chart(400, negative).gridlines[0].value).toBe(-200)
    })
    it('finds the round nearest a position on the plot', () => {
        const built = chart(400)
        expect(nearestRound(built, 4, built.plotLeft - 20)).toBe(0)
        expect(nearestRound(built, 4, built.x(2) + 3)).toBe(2)
        expect(nearestRound(built, 4, built.plotRight + 50)).toBe(3)
    })
    it('spreads end labels apart, keeping their order and staying above the axis', () => {
        expect(spreadLabels([50, 52, 120], 14, 190)).toEqual([50, 64, 120])
        expect(spreadLabels([188, 186], 14, 190)).toEqual([190, 176])
    })
})
