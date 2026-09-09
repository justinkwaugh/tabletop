import * as Type from 'typebox'
import {
    assert,
    assertExists,
    CardinalDirection,
    createCoordinatedNode,
    RectilinearGrid,
    type RectilinearGridNode
} from '@tabletop/common'

export const StockMarketSpace = Type.Object(
    {
        id: Type.String(),
        price: Type.Integer({ minimum: 1 }),
        row: Type.Integer({ minimum: 0 }),
        column: Type.Integer({ minimum: 0 }),
        color: Type.String(),
        moves: Type.Record(Type.String(), Type.String())
    },
    { additionalProperties: false }
)
export type StockMarketSpace = Type.Static<typeof StockMarketSpace>
export const StockMarket = Type.Object(
    {
        spaces: Type.Array(StockMarketSpace),
        stacks: Type.Array(
            Type.Object(
                { spaceId: Type.String(), companyIds: Type.Array(Type.String()) },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type StockMarket = Type.Static<typeof StockMarket>

export function createRectangularStockMarket(
    rows: readonly (readonly (number | null)[])[],
    color: (row: number, column: number) => string
): StockMarket {
    const grid = new RectilinearGrid<RectilinearGridNode & { space: StockMarketSpace }>()
    const spaces: StockMarketSpace[] = []
    for (const [row, prices] of rows.entries())
        for (const [column, price] of prices.entries()) {
            if (price === null) continue
            const space: StockMarketSpace = {
                id: `${row}:${column}`,
                price,
                row,
                column,
                color: color(row, column),
                moves: {}
            }
            spaces.push(space)
            grid.setNode({
                ...createCoordinatedNode({ row, col: column }),
                space
            })
        }
    for (const node of grid) {
        for (const [move, direction] of [
            ['up', CardinalDirection.North],
            ['down', CardinalDirection.South],
            ['left', CardinalDirection.West],
            ['right', CardinalDirection.East]
        ] as const) {
            const neighbor = grid.neighborOf(node, direction)
            if (neighbor) node.space.moves[move] = neighbor.space.id
        }
    }
    return { spaces, stacks: [] }
}
export function stockMarketSpace(market: StockMarket, spaceId: string): StockMarketSpace {
    const space = market.spaces.find((space) => space.id === spaceId)
    assertExists(space, `Unknown stock market space: ${spaceId}`)
    return space
}
export function companyMarketSpace(market: StockMarket, companyId: string): StockMarketSpace {
    const stack = market.stacks.find((stack) => stack.companyIds.includes(companyId))
    assertExists(stack, `Company has no stock market marker: ${companyId}`)
    return stockMarketSpace(market, stack.spaceId)
}
export function moveMarketSpace(
    market: StockMarket,
    spaceId: string,
    direction: string,
    steps: number
): StockMarketSpace {
    let space = stockMarketSpace(market, spaceId)
    for (let step = 0; step < steps; step++) {
        const next = space.moves[direction]
        if (!next) break
        space = stockMarketSpace(market, next)
    }
    return space
}
export function placeStockMarker(market: StockMarket, companyId: string, spaceId: string): void {
    stockMarketSpace(market, spaceId)
    const previous = market.stacks.find((stack) => stack.companyIds.includes(companyId))
    if (previous?.spaceId === spaceId) return
    if (previous) previous.companyIds.splice(previous.companyIds.indexOf(companyId), 1)
    let target = market.stacks.find((stack) => stack.spaceId === spaceId)
    if (!target) {
        target = { spaceId, companyIds: [] }
        market.stacks.push(target)
    }
    target.companyIds.push(companyId)
    market.stacks = market.stacks.filter((stack) => stack.companyIds.length > 0)
}
export function stockMarketOrder(market: StockMarket): string[] {
    return [...market.stacks]
        .sort((a, b) => {
            const left = stockMarketSpace(market, a.spaceId)
            const right = stockMarketSpace(market, b.spaceId)
            return right.price - left.price || right.column - left.column || left.row - right.row
        })
        .flatMap((stack) => stack.companyIds)
}
export function validateStockMarket(market: StockMarket, companyIds: readonly string[]): void {
    assert(
        new Set(market.spaces.map((space) => space.id)).size === market.spaces.length,
        'Duplicate stock market space'
    )
    assert(
        new Set(market.stacks.map((stack) => stack.spaceId)).size === market.stacks.length,
        'Duplicate market stack'
    )
    const placed = market.stacks.flatMap((stack) => stack.companyIds)
    assert(new Set(placed).size === placed.length, 'Duplicate stock market marker')
    for (const id of placed) assert(companyIds.includes(id), 'Unknown stock market company')
    for (const stack of market.stacks) stockMarketSpace(market, stack.spaceId)
    for (const space of market.spaces)
        for (const next of Object.values(space.moves)) stockMarketSpace(market, next)
}
