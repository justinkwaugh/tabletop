import { columnPath, valueAxis } from './chartGeometry'
import { monthName, type MonthIndex, type MonthlyGames } from './gameStats'

const AXIS_WIDTH = 22
const AXIS_LABEL_HEIGHT = 20
const PLOT_TOP = 6
const MAX_COLUMN_WIDTH = 22
const COLUMN_SPACING = 4
const SEGMENT_GAP = 2
const COLUMN_RADIUS = 3
const MONTH_LABEL_WIDTH = 70

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
    const plotBottom = height - AXIS_LABEL_HEIGHT
    const { y, gridlines } = valueAxis(
        Math.max(0, ...monthlyGames.map((entry) => entry.games)),
        PLOT_TOP,
        plotBottom
    )
    const slotWidth = (width - AXIS_WIDTH) / months.length
    const columnWidth = Math.max(1, Math.min(MAX_COLUMN_WIDTH, slotWidth - COLUMN_SPACING))
    const labelEvery = Math.ceil(months.length / Math.max(2, Math.floor(width / MONTH_LABEL_WIDTH)))
    return {
        plotLeft: AXIS_WIDTH,
        plotBottom,
        slotWidth,
        gridlines,
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
