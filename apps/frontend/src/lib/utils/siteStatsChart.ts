import { columnPath, valueAxis } from './chartGeometry'

export type ChartSeries = { key: string; values: (number | undefined)[] }

export type ChartTone = 'blue' | 'orange' | 'green'

export type SiteChartSeries = ChartSeries & {
    name: string
    tone: ChartTone
    kind: 'column' | 'line'
}

type SeriesPath = { key: string; path: string }

export type SiteChartSlot = {
    slotX: number
    centerX: number
    topY: number
    label?: string
    columns: SeriesPath[]
}

export type SiteChart = {
    plotLeft: number
    plotBottom: number
    slotWidth: number
    gridlines: { value: number; y: number; label: string }[]
    slots: SiteChartSlot[]
    lines: SeriesPath[]
}

const AXIS_LABEL_HEIGHT = 20
const AXIS_DIGIT_WIDTH = 7
const AXIS_GAP = 10
const PLOT_TOP = 6
const MAX_GROUP_WIDTH = 26
const COLUMN_SPACING = 2
const GROUPED_COLUMN_GAP = 1
const COLUMN_RADIUS = 2
const SLOT_LABEL_WIDTH = 64

export function siteChart({
    labels,
    columns,
    lines,
    width,
    height
}: {
    labels: string[]
    columns: ChartSeries[]
    lines: ChartSeries[]
    width: number
    height: number
}): SiteChart {
    const values = [...columns, ...lines].flatMap((series) =>
        series.values.filter((value) => value !== undefined)
    )
    const plotBottom = height - AXIS_LABEL_HEIGHT
    const { ceiling, y, gridlines } = valueAxis(Math.max(0, ...values), PLOT_TOP, plotBottom)
    const plotLeft = AXIS_GAP + AXIS_DIGIT_WIDTH * ceiling.toLocaleString().length
    const slotWidth = (width - plotLeft) / Math.max(1, labels.length)
    const groupWidth = Math.max(1, Math.min(MAX_GROUP_WIDTH, slotWidth - COLUMN_SPACING))
    const columnWidth = Math.max(
        1,
        (groupWidth - GROUPED_COLUMN_GAP * (columns.length - 1)) / Math.max(1, columns.length)
    )
    const labelEvery = Math.ceil(
        labels.length / Math.max(2, Math.floor((width - plotLeft) / SLOT_LABEL_WIDTH))
    )
    const centerX = (index: number) => plotLeft + (index + 0.5) * slotWidth
    return {
        plotLeft,
        plotBottom,
        slotWidth,
        gridlines: gridlines.map((line) => ({ ...line, label: line.value.toLocaleString() })),
        slots: labels.map((label, index) => {
            const groupX = centerX(index) - groupWidth / 2
            const slotValues = [...columns, ...lines].map((series) => series.values[index] ?? 0)
            return {
                slotX: plotLeft + index * slotWidth,
                centerX: centerX(index),
                topY: y(Math.max(0, ...slotValues)),
                label: (labels.length - 1 - index) % labelEvery === 0 ? label : undefined,
                columns: columns.flatMap((series, seriesIndex) => {
                    const value = series.values[index]
                    if (!value) return []
                    const x = groupX + seriesIndex * (columnWidth + GROUPED_COLUMN_GAP)
                    return [
                        {
                            key: series.key,
                            path: columnPath(x, y(value), columnWidth, plotBottom, COLUMN_RADIUS)
                        }
                    ]
                })
            }
        }),
        lines: lines.map((series) => ({
            key: series.key,
            path: linePath(series.values, centerX, y)
        }))
    }
}

function linePath(
    values: (number | undefined)[],
    x: (index: number) => number,
    y: (value: number) => number
): string {
    let path = ''
    let drawing = false
    values.forEach((value, index) => {
        if (value === undefined) {
            drawing = false
            return
        }
        path += `${drawing ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`
        drawing = true
    })
    return path
}
