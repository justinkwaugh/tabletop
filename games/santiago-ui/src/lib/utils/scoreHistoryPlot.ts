import type { Point } from '@tabletop/common'
import type { PlayerRoundScores } from '@tabletop/santiago'

export type ScoreHistoryFrame = {
    width: number
    height: number
    inset: { top: number; right: number; bottom: number; left: number }
}

export type ScoreHistoryLine = {
    playerId: string
    points: Point[]
    path: string
}

export type ScoreHistoryPlot = {
    rounds: { round: number; x: number }[]
    scoreTicks: { score: number; y: number }[]
    lines: ScoreHistoryLine[]
    nearestRoundIndex(x: number): number
}

const TARGET_TICK_COUNT = 4
const NICE_STEP_FACTORS = [1, 2, 5, 10]

export function niceScoreTicks(maxScore: number): number[] {
    const roughStep = Math.max(maxScore, 1) / TARGET_TICK_COUNT
    const magnitude = 10 ** Math.floor(Math.log10(roughStep))
    const factor = NICE_STEP_FACTORS.find((candidate) => candidate * magnitude >= roughStep) ?? 10
    const step = Math.max(1, factor * magnitude)
    const top = Math.max(step, Math.ceil(maxScore / step) * step)
    return Array.from({ length: top / step + 1 }, (_, index) => index * step)
}

export function plotScoreHistory(
    series: PlayerRoundScores[],
    { width, height, inset }: ScoreHistoryFrame
): ScoreHistoryPlot {
    const roundCount = Math.max(...series.map((entry) => entry.scores.length))
    const plotWidth = width - inset.left - inset.right
    const plotHeight = height - inset.top - inset.bottom
    const roundSpacing = roundCount > 1 ? plotWidth / (roundCount - 1) : 0
    const firstRoundX = roundCount > 1 ? inset.left : inset.left + plotWidth / 2

    const ticks = niceScoreTicks(Math.max(...series.flatMap((entry) => entry.scores)))
    const topScore = ticks[ticks.length - 1]

    const xForRound = (index: number) => firstRoundX + index * roundSpacing
    const yForScore = (score: number) => inset.top + plotHeight * (1 - score / topScore)

    return {
        rounds: Array.from({ length: roundCount }, (_, index) => ({
            round: index + 1,
            x: xForRound(index)
        })),
        scoreTicks: ticks.map((score) => ({ score, y: yForScore(score) })),
        lines: series.map(({ playerId, scores }) => {
            const points = scores.map((score, index) => ({
                x: xForRound(index),
                y: yForScore(score)
            }))
            return {
                playerId,
                points,
                path: points.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x},${y}`).join('')
            }
        }),
        nearestRoundIndex(x: number) {
            if (roundSpacing === 0) return 0
            const index = Math.round((x - firstRoundX) / roundSpacing)
            return Math.min(roundCount - 1, Math.max(0, index))
        }
    }
}
