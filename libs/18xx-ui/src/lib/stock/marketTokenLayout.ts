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

/** Where the market's columns and rows fall, in unscaled scene pixels. */
export interface MarketGeometry {
    readonly cell: MarketCellDimensions
    readonly columnLefts: readonly number[]
    /** Whether a gap comes before each column, either side of a set-apart zone's columns. */
    readonly gapBefore: readonly boolean[]
    readonly rows: number
    readonly width: number
    readonly height: number
}

export function marketGeometry(
    chart: StockMarketChart,
    cell = DefaultMarketCell,
    zones: readonly MarketZone[] = []
): MarketGeometry {
    const columns = Math.max(...chart.spaces.map((space) => space.column)) + 1
    const rows = Math.max(...chart.spaces.map((space) => space.row)) + 1
    const apartColors = new Set(zones.filter((zone) => zone.setApart).map((zone) => zone.color))
    const groups = Array.from(
        { length: columns },
        (_, column) =>
            chart.spaces.find((space) => space.column === column && apartColors.has(space.color))
                ?.color
    )
    const gapBefore = groups.map((group, column) => column > 0 && group !== groups[column - 1])
    let left = 0
    const columnLefts = gapBefore.map((gap) => {
        if (gap) left += MarketZoneGap
        const columnLeft = left
        left += cell.width
        return columnLeft
    })
    return { cell, columnLefts, gapBefore, rows, width: left, height: rows * cell.height }
}

/**
 * The largest empty rectangle in the market's lower-right corner, in unscaled scene pixels, or
 * undefined when the bottom row reaches the last column.
 */
export function marketLowerRightSpace(
    chart: StockMarketChart,
    geometry = marketGeometry(chart)
): BoundingBox | undefined {
    const { cell, columnLefts, rows } = geometry
    let firstEmptyColumn = 0
    let largest: BoundingBox | undefined
    for (let top = rows - 1; top >= 0; top--) {
        const occupied = chart.spaces.filter((space) => space.row === top)
        firstEmptyColumn = Math.max(firstEmptyColumn, ...occupied.map((space) => space.column + 1))
        if (firstEmptyColumn >= columnLefts.length) break
        const space = {
            x: MarketScenePadding + columnLefts[firstEmptyColumn],
            y: MarketScenePadding + top * cell.height,
            width: geometry.width - columnLefts[firstEmptyColumn],
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
    geometry = marketGeometry(chart)
) {
    const { cell, columnLefts } = geometry
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
            x: columnLefts[space.column] + x,
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
    geometry = marketGeometry(chart)
): Point[] {
    const { cell, columnLefts, width, height } = geometry
    const count = market.stacks.find((stack) => stack.spaceId === spaceId)?.companyIds.length ?? 0
    const space = chart.space(spaceId)
    const step = MarketTokenSize + 4
    const span = Math.max(0, count - 1) * step
    const radius = MarketTokenSize / 2
    const x = Math.max(
        radius,
        Math.min(width - radius, columnLefts[space.column] + stackOffsetX(count, cell))
    )
    const y = Math.max(
        radius,
        Math.min(height - radius - span, (space.row + 0.5) * cell.height - span / 2)
    )
    return Array.from({ length: count }, (_, index) => ({ x, y: y + index * step }))
}
