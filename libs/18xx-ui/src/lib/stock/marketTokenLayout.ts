import { stockMarketSpace, type StockMarket } from '@tabletop/18xx'
import type { BoundingBox, Point } from '@tabletop/common'

export const MarketCellWidth = 62
export const MarketCellHeight = 68
export const MarketTokenSize = 26
export const MarketScenePadding = 6
// Stacked tokens sit against the cell's right edge, clear of the price at the upper left.
const MarketStackInset = 4

/**
 * The largest empty rectangle in the market's lower-right corner, in unscaled scene pixels, or
 * undefined when the bottom row reaches the last column.
 */
export function marketLowerRightSpace(market: StockMarket): BoundingBox | undefined {
    const columns = Math.max(...market.spaces.map((space) => space.column)) + 1
    const rows = Math.max(...market.spaces.map((space) => space.row)) + 1
    let firstEmptyColumn = 0
    let largest: BoundingBox | undefined
    for (let top = rows - 1; top >= 0; top--) {
        const occupied = market.spaces.filter((space) => space.row === top)
        firstEmptyColumn = Math.max(firstEmptyColumn, ...occupied.map((space) => space.column + 1))
        if (firstEmptyColumn >= columns) break
        const space = {
            x: MarketScenePadding + firstEmptyColumn * MarketCellWidth,
            y: MarketScenePadding + top * MarketCellHeight,
            width: (columns - firstEmptyColumn) * MarketCellWidth,
            height: (rows - top) * MarketCellHeight
        }
        if (!largest || space.width * space.height > largest.width * largest.height) largest = space
    }
    return largest
}

function stackOffsetX(count: number) {
    return count > 1
        ? MarketCellWidth - MarketStackInset - MarketTokenSize / 2
        : MarketCellWidth / 2
}

export function marketTokenLayout(market: StockMarket) {
    return market.stacks.flatMap((stack) => {
        const space = stockMarketSpace(market, stack.spaceId)
        const step =
            stack.companyIds.length > 1
                ? Math.min(
                      MarketTokenSize + 2,
                      (MarketCellHeight - MarketTokenSize - 8) / (stack.companyIds.length - 1)
                  )
                : 0
        const x = stackOffsetX(stack.companyIds.length)
        return stack.companyIds.map((companyId, index) => ({
            companyId,
            spaceId: space.id,
            x: space.column * MarketCellWidth + x,
            y:
                space.row * MarketCellHeight +
                MarketCellHeight / 2 +
                (index - (stack.companyIds.length - 1) / 2) * step,
            z: stack.companyIds.length - index,
            overlapped: step < MarketTokenSize && stack.companyIds.length > 1
        }))
    })
}

export function expandedMarketStack(market: StockMarket, spaceId: string): Point[] {
    const count = market.stacks.find((stack) => stack.spaceId === spaceId)?.companyIds.length ?? 0
    const space = stockMarketSpace(market, spaceId)
    const width = (Math.max(...market.spaces.map((item) => item.column)) + 1) * MarketCellWidth
    const height = (Math.max(...market.spaces.map((item) => item.row)) + 1) * MarketCellHeight
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
            space.column * MarketCellWidth + stackOffsetX(count) - spanX / 2
        )
    )
    const y = Math.max(
        radius,
        Math.min(height - radius - spanY, (space.row + 0.5) * MarketCellHeight - spanY / 2)
    )
    return Array.from({ length: count }, (_, index) => ({
        x: x + Math.floor(index / rows) * step,
        y: y + (index % rows) * step
    }))
}
