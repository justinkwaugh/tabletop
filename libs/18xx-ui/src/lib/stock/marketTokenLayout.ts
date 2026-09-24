import { stockMarketSpace, type StockMarket } from '@tabletop/18xx'
import type { Point } from '@tabletop/common'

export const MarketCellWidth = 62
export const MarketCellHeight = 68
export const MarketTokenSize = 26

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
        return stack.companyIds.map((companyId, index) => ({
            companyId,
            spaceId: space.id,
            x: space.column * MarketCellWidth + MarketCellWidth / 2,
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
        Math.min(width - radius - spanX, (space.column + 0.5) * MarketCellWidth - spanX / 2)
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
