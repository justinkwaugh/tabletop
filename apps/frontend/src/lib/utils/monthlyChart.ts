import { monthName, type MonthIndex, type MonthlyGames } from './gameStats'

const AXIS_WIDTH = 22
const AXIS_LABEL_HEIGHT = 20
const PLOT_TOP = 6
const MAX_COLUMN_WIDTH = 22
const COLUMN_SPACING = 4
const SEGMENT_GAP = 2
const COLUMN_RADIUS = 3
const MONTH_LABEL_WIDTH = 70
const MAX_GRID_INTERVALS = 5

export type MonthlyChartColumn = MonthlyGames & {
    slotX: number
    centerX: number
    topY: number
    wonOrTiedPath?: string
    lostPath?: string
    label?: string
}

export type MonthlyChart = {
    plotLeft: number
    plotBottom: number
    slotWidth: number
    gridlines: { value: number; y: number }[]
    columns: MonthlyChartColumn[]
}

export function monthlyChart(
    monthlyGames: MonthlyGames[],
    months: MonthIndex[],
    width: number,
    height: number
): MonthlyChart {
    const byMonth = new Map(monthlyGames.map((entry) => [entry.month, entry]))
    const peak = Math.max(1, ...monthlyGames.map((entry) => entry.games))
    const step = gridStep(peak)
    const ceiling = Math.ceil(peak / step) * step
    const plotBottom = height - AXIS_LABEL_HEIGHT
    const plotHeight = plotBottom - PLOT_TOP
    const y = (value: number) => plotBottom - (value / ceiling) * plotHeight
    const slotWidth = (width - AXIS_WIDTH) / months.length
    const columnWidth = Math.max(1, Math.min(MAX_COLUMN_WIDTH, slotWidth - COLUMN_SPACING))
    const labelEvery = Math.ceil(months.length / Math.max(2, Math.floor(width / MONTH_LABEL_WIDTH)))
    return {
        plotLeft: AXIS_WIDTH,
        plotBottom,
        slotWidth,
        gridlines: Array.from({ length: ceiling / step + 1 }, (_, index) => ({
            value: index * step,
            y: y(index * step)
        })),
        columns: months.map((month, index) => {
            const { games = 0, wonOrTied = 0 } = byMonth.get(month) ?? {}
            const slotX = AXIS_WIDTH + index * slotWidth
            const x = slotX + (slotWidth - columnWidth) / 2
            const lost = games - wonOrTied
            return {
                month,
                games,
                wonOrTied,
                slotX,
                centerX: slotX + slotWidth / 2,
                topY: y(games),
                wonOrTiedPath:
                    wonOrTied > 0
                        ? columnPath(
                              x,
                              y(wonOrTied),
                              columnWidth,
                              plotBottom,
                              lost > 0 ? 0 : COLUMN_RADIUS
                          )
                        : undefined,
                lostPath:
                    lost > 0
                        ? columnPath(
                              x,
                              y(games),
                              columnWidth,
                              y(wonOrTied) - (wonOrTied > 0 ? SEGMENT_GAP : 0),
                              COLUMN_RADIUS
                          )
                        : undefined,
                label:
                    (months.length - 1 - index) % labelEvery === 0
                        ? monthName(month, 'short')
                        : undefined
            }
        })
    }
}

function gridStep(peak: number): number {
    let magnitude = 1
    for (;;) {
        for (const multiple of [1, 2, 5]) {
            if (peak / (multiple * magnitude) <= MAX_GRID_INTERVALS) return multiple * magnitude
        }
        magnitude *= 10
    }
}

function columnPath(x: number, top: number, width: number, bottom: number, radius: number): string {
    const corner = Math.max(0, Math.min(radius, bottom - top, width / 2))
    return `M${x},${bottom}V${top + corner}a${corner},${corner} 0 0 1 ${corner},${-corner}h${width - 2 * corner}a${corner},${corner} 0 0 1 ${corner},${corner}V${bottom}Z`
}
