import { describe, expect, it } from 'vitest'
import { niceScoreTicks, plotScoreHistory } from './scoreHistoryPlot.js'

const frame = { width: 200, height: 100, inset: { top: 0, right: 0, bottom: 0, left: 0 } }

describe('niceScoreTicks', () => {
    it.each([
        [0, [0, 1]],
        [4, [0, 1, 2, 3, 4]],
        [47, [0, 20, 40, 60]],
        [50, [0, 20, 40, 60]],
        [61, [0, 20, 40, 60, 80]],
        [130, [0, 50, 100, 150]]
    ])('covers a maximum of %i with round steps', (max, ticks) => {
        expect(niceScoreTicks(0, max)).toEqual(ticks)
    })

    it('extends below zero to cover a negative score', () => {
        expect(niceScoreTicks(-3, 30)).toEqual([-10, 0, 10, 20, 30])
    })
})

describe('plotScoreHistory', () => {
    it('spreads rounds across the width and scores up from the bottom', () => {
        const plot = plotScoreHistory(
            [
                { playerId: 'a', scores: [0, 2, 4] },
                { playerId: 'b', scores: [4, 3, 1] }
            ],
            frame
        )
        expect(plot.rounds).toEqual([
            { round: 1, x: 0 },
            { round: 2, x: 100 },
            { round: 3, x: 200 }
        ])
        expect(plot.scoreTicks.map((tick) => [tick.score, tick.y])).toEqual([
            [0, 100],
            [1, 75],
            [2, 50],
            [3, 25],
            [4, 0]
        ])
        expect(plot.lines).toEqual([
            {
                playerId: 'a',
                points: [
                    { x: 0, y: 100 },
                    { x: 100, y: 50 },
                    { x: 200, y: 0 }
                ],
                path: 'M0,100L100,50L200,0'
            },
            {
                playerId: 'b',
                points: [
                    { x: 0, y: 0 },
                    { x: 100, y: 25 },
                    { x: 200, y: 75 }
                ],
                path: 'M0,0L100,25L200,75'
            }
        ])
    })

    it('offsets the plot by its inset', () => {
        const plot = plotScoreHistory([{ playerId: 'a', scores: [0, 1] }], {
            width: 120,
            height: 70,
            inset: { top: 10, right: 10, bottom: 20, left: 10 }
        })
        expect(plot.lines[0].points).toEqual([
            { x: 10, y: 50 },
            { x: 110, y: 10 }
        ])
    })

    it('finds the round nearest a horizontal position', () => {
        const plot = plotScoreHistory([{ playerId: 'a', scores: [0, 1, 2] }], frame)
        expect([-20, 49, 51, 160, 260].map((x) => plot.nearestRoundIndex(x))).toEqual([
            0, 0, 1, 2, 2
        ])
    })

    it('keeps a negative score inside the plot', () => {
        const plot = plotScoreHistory([{ playerId: 'a', scores: [-10, 30] }], frame)
        expect(plot.scoreTicks.map((tick) => tick.score)).toEqual([-10, 0, 10, 20, 30])
        expect(plot.lines[0].points).toEqual([
            { x: 0, y: 100 },
            { x: 200, y: 0 }
        ])
    })
})
