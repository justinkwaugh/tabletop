import { stockMarketSpace, type StockMarket } from '@tabletop/18xx'
import type { BoundingBox, Point } from '@tabletop/common'

export const MarketCellWidth = 62
export const MarketCellHeight = 68
export type MarketCellDimensions = Pick<BoundingBox, 'width' | 'height'>
export const DefaultMarketCell: MarketCellDimensions = {
    width: MarketCellWidth,
    height: MarketCellHeight
}
export const MarketTokenSize = 26
export const MarketScenePadding = 6
// Stacked tokens sit against the cell's right edge, clear of the price at the upper left.
const MarketStackInset = 4

/**
 * The largest empty rectangle in the market's lower-right corner, in unscaled scene pixels, or
 * undefined when the bottom row reaches the last column.
 */
export function marketLowerRightSpace(
    market: StockMarket,
    cell = DefaultMarketCell
): BoundingBox | undefined {
    const columns = Math.max(...market.spaces.map((space) => space.column)) + 1
    const rows = Math.max(...market.spaces.map((space) => space.row)) + 1
    let firstEmptyColumn = 0
    let largest: BoundingBox | undefined
    for (let top = rows - 1; top >= 0; top--) {
        const occupied = market.spaces.filter((space) => space.row === top)
        firstEmptyColumn = Math.max(firstEmptyColumn, ...occupied.map((space) => space.column + 1))
        if (firstEmptyColumn >= columns) break
        const space = {
            x: MarketScenePadding + firstEmptyColumn * cell.width,
            y: MarketScenePadding + top * cell.height,
            width: (columns - firstEmptyColumn) * cell.width,
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

export function marketTokenLayout(market: StockMarket, cell = DefaultMarketCell) {
    const topInset = cell.width < 50 ? 20 : MarketStackInset
    const tokenHeight = cell.height - topInset - MarketStackInset
    return market.stacks.flatMap((stack) => {
        const space = stockMarketSpace(market, stack.spaceId)
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
            x: space.column * cell.width + x,
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

export function expandedMarketStack(
    market: StockMarket,
    spaceId: string,
    cell = DefaultMarketCell
): Point[] {
    const count = market.stacks.find((stack) => stack.spaceId === spaceId)?.companyIds.length ?? 0
    const space = stockMarketSpace(market, spaceId)
    const width = (Math.max(...market.spaces.map((item) => item.column)) + 1) * cell.width
    const height = (Math.max(...market.spaces.map((item) => item.row)) + 1) * cell.height
    const step = MarketTokenSize + 4
    const columns = Math.ceil(count / Math.max(1, Math.floor(height / step)))
    const rows = Math.ceil(count / Math.max(1, columns))
    const spanX = Math.max(0, columns - 1) * step
    const spanY = Math.max(0, rows - 1) * step
    const radius = MarketTokenSize / 2
    const x = Math.max(
        radius,
        Math.min(
            width - radius - spanX,
            space.column * cell.width + stackOffsetX(count, cell) - spanX / 2
        )
    )
    const y = Math.max(
        radius,
        Math.min(height - radius - spanY, (space.row + 0.5) * cell.height - spanY / 2)
    )
    return Array.from({ length: count }, (_, index) => ({
        x: x + Math.floor(index / rows) * step,
        y: y + (index % rows) * step
    }))
}
