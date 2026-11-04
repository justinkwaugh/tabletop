import type { WealthPoint } from './wealthHistory.js'

export type WealthChart = {
    plotLeft: number
    plotRight: number
    plotTop: number
    plotBottom: number
    gridlines: { value: number; y: number }[]
    roundLabels: { index: number; x: number; label: string }[]
    lines: { playerId: string; path: string }[]
    x: (index: number) => number
    y: (value: number) => number
}

const MAX_GRID_INTERVALS = 5
const PLOT_TOP = 10
const PLOT_RIGHT_GAP = 14
const ROUND_LABEL_HEIGHT = 22
const ROUND_LABEL_WIDTH = 56

/** Player wealth by round: rounds evenly spaced along x, wealth from zero along y. */
export function wealthChart({
    points,
    playerIds,
    width,
    height,
    valueLabelWidth
}: {
    points: readonly WealthPoint[]
    playerIds: readonly string[]
    width: number
    height: number
    /** The width the axis needs for the label of a value. */
    valueLabelWidth: (value: number) => number
}): WealthChart {
    const values = points.flatMap((point) => playerIds.map((id) => point.wealth[id] ?? 0))
    const lowest = Math.min(0, ...values)
    const highest = Math.max(1, ...values)
    const step = gridStep(highest - lowest)
    const floor = Math.floor(lowest / step) * step
    const ceiling = Math.ceil(highest / step) * step
    const gridValues = Array.from(
        { length: Math.round((ceiling - floor) / step) + 1 },
        (_, index) => floor + index * step
    )
    const plotLeft = 8 + Math.max(...gridValues.map(valueLabelWidth))
    const plotRight = width - PLOT_RIGHT_GAP
    const plotTop = PLOT_TOP
    const plotBottom = height - ROUND_LABEL_HEIGHT
    const spacing = (plotRight - plotLeft) / Math.max(1, points.length - 1)
    const x = (index: number) => plotLeft + index * spacing
    const y = (value: number) =>
        plotBottom - ((value - floor) / (ceiling - floor)) * (plotBottom - plotTop)
    const labelEvery = Math.max(1, Math.ceil(ROUND_LABEL_WIDTH / spacing))
    const path = (playerId: string) =>
        points
            .map(
                (point, index) =>
                    `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.wealth[playerId] ?? 0).toFixed(1)}`
            )
            .join('')
    return {
        plotLeft,
        plotRight,
        plotTop,
        plotBottom,
        gridlines: gridValues.map((value) => ({ value, y: y(value) })),
        // The latest round is always labelled; earlier ones are thinned back from it.
        roundLabels: points.flatMap((point, index) =>
            (points.length - 1 - index) % labelEvery === 0
                ? [{ index, x: x(index), label: point.label }]
                : []
        ),
        lines: playerIds.map((playerId) => ({ playerId, path: path(playerId) })),
        x,
        y
    }
}

/** The round nearest a horizontal position on the plot. */
export function nearestRound(chart: WealthChart, count: number, position: number): number {
    if (count <= 1) return 0
    const spacing = (chart.plotRight - chart.plotLeft) / (count - 1)
    return Math.max(0, Math.min(count - 1, Math.round((position - chart.plotLeft) / spacing)))
}

/** Moves labels at these heights apart to at least `spacing`, keeping them above `bottom`. */
export function spreadLabels(
    heights: readonly number[],
    spacing: number,
    bottom: number
): number[] {
    const order = heights.map((_, index) => index).toSorted((a, b) => heights[a] - heights[b])
    const spread = [...heights]
    for (const [position, index] of order.entries())
        if (position > 0)
            spread[index] = Math.max(spread[index], spread[order[position - 1]] + spacing)
    const overflow = Math.max(0, ...spread) - bottom
    if (overflow > 0) for (const index of order) spread[index] -= overflow
    for (let position = order.length - 2; position >= 0; position--)
        spread[order[position]] = Math.min(
            spread[order[position]],
            spread[order[position + 1]] - spacing
        )
    return spread
}

function gridStep(range: number): number {
    let magnitude = 1
    for (;;) {
        for (const multiple of [1, 2, 5]) {
            if (range / (multiple * magnitude) <= MAX_GRID_INTERVALS) return multiple * magnitude
        }
        magnitude *= 10
    }
}
