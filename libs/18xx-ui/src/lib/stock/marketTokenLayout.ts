import type { StockMarket, StockMarketChart } from '@tabletop/18xx'
import type { BoundingBox, Point } from '@tabletop/common'
import type { MarketZone } from '../session/titlePresentation.js'

export const MarketCellWidth = 62
export const MarketCellHeight = 68
export type MarketCellDimensions = Pick<BoundingBox, 'width' | 'height'>
export const DefaultMarketCell: MarketCellDimensions = {
    width: MarketCellWidth,
    height: MarketCellHeight
}
export const MarketTokenSize = 26
export const MarketScenePadding = 6
export const MarketZoneBannerHeight = 24
/** The space either side of a set-apart zone's columns. */
export const MarketZoneGap = 8
// Stacked tokens sit against the cell's right edge, clear of the price at the upper left.
const MarketStackInset = 4

/**
 * Each column's left edge in unscaled scene pixels, with a gap between the columns of a set-apart
 * zone and the columns either side of them.
 */
export function marketColumnLefts(
    chart: StockMarketChart,
    cell = DefaultMarketCell,
    zones: readonly MarketZone[] = []
): number[] {
    const columns = Math.max(...chart.spaces.map((space) => space.column)) + 1
    const apartColors = new Set(zones.filter((zone) => zone.setApart).map((zone) => zone.color))
    const groups = Array.from(
        { length: columns },
        (_, column) =>
            chart.spaces.find((space) => space.column === column && apartColors.has(space.color))
                ?.color
    )
    let left = 0
    return groups.map((group, column) => {
        if (column > 0 && group !== groups[column - 1]) left += MarketZoneGap
        const columnLeft = left
        left += cell.width
        return columnLeft
    })
}

/** The width of the market's columns and gaps, in unscaled scene pixels. */
export function marketColumnsWidth(lefts: readonly number[], cell = DefaultMarketCell): number {
    return (lefts.at(-1) ?? 0) + cell.width
}

/**
 * The largest empty rectangle in the market's lower-right corner, in unscaled scene pixels, or
 * undefined when the bottom row reaches the last column.
 */
export function marketLowerRightSpace(
    chart: StockMarketChart,
    cell = DefaultMarketCell,
    zones: readonly MarketZone[] = []
): BoundingBox | undefined {
    const lefts = marketColumnLefts(chart, cell, zones)
    const columns = lefts.length
    const rows = Math.max(...chart.spaces.map((space) => space.row)) + 1
    let firstEmptyColumn = 0
    let largest: BoundingBox | undefined
    for (let top = rows - 1; top >= 0; top--) {
        const occupied = chart.spaces.filter((space) => space.row === top)
        firstEmptyColumn = Math.max(firstEmptyColumn, ...occupied.map((space) => space.column + 1))
        if (firstEmptyColumn >= columns) break
        const space = {
            x: MarketScenePadding + lefts[firstEmptyColumn],
            y: MarketScenePadding + top * cell.height,
            width: marketColumnsWidth(lefts, cell) - lefts[firstEmptyColumn],
            height: (rows - top) * cell.height
        }
        if (!largest || space.width * space.height > largest.width * largest.height) largest = space
    }
    return largest
}

function stackOffsetX(count: number, cell: MarketCellDimensions) {
    return count > 1 && cell.width >= 50
        ? cell.width - MarketStackInset - MarketTokenSize / 2
        : cell.width / 2
}

export function marketTokenLayout(
    chart: StockMarketChart,
    market: StockMarket,
    cell = DefaultMarketCell,
    zones: readonly MarketZone[] = []
) {
    const lefts = marketColumnLefts(chart, cell, zones)
    const topInset = cell.width < 50 ? 20 : MarketStackInset
    const tokenHeight = cell.height - topInset - MarketStackInset
    return market.stacks.flatMap((stack) => {
        const space = chart.space(stack.spaceId)
        const step =
            stack.companyIds.length > 1
                ? Math.min(
                      MarketTokenSize + 2,
                      (tokenHeight - MarketTokenSize) / (stack.companyIds.length - 1)
                  )
                : 0
        const x = stackOffsetX(stack.companyIds.length, cell)
        return stack.companyIds.map((companyId, index) => ({
            companyId,
            spaceId: space.id,
            x: lefts[space.column] + x,
            y:
                space.row * cell.height +
                topInset +
                tokenHeight / 2 +
                (index - (stack.companyIds.length - 1) / 2) * step,
            z: stack.companyIds.length - index,
            overlapped: step < MarketTokenSize && stack.companyIds.length > 1
        }))
    })
}

/**
 * A hovered stack fanned out as one column in stack order, which is its operating order; a column
 * taller than the market starts at its top and extends below it.
 */
export function expandedMarketStack(
    chart: StockMarketChart,
    market: StockMarket,
    spaceId: string,
    cell = DefaultMarketCell,
    zones: readonly MarketZone[] = []
): Point[] {
    const count = market.stacks.find((stack) => stack.spaceId === spaceId)?.companyIds.length ?? 0
    const space = chart.space(spaceId)
    const lefts = marketColumnLefts(chart, cell, zones)
    const width = marketColumnsWidth(lefts, cell)
    const height = (Math.max(...chart.spaces.map((item) => item.row)) + 1) * cell.height
    const step = MarketTokenSize + 4
    const span = Math.max(0, count - 1) * step
    const radius = MarketTokenSize / 2
    const x = Math.max(
        radius,
        Math.min(width - radius, lefts[space.column] + stackOffsetX(count, cell))
    )
    const y = Math.max(
        radius,
        Math.min(height - radius - span, (space.row + 0.5) * cell.height - span / 2)
    )
    return Array.from({ length: count }, (_, index) => ({ x, y: y + index * step }))
}
