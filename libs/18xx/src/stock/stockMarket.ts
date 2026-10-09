import * as Type from 'typebox'
import { Clone } from 'typebox/value'
import {
    assert,
    assertExists,
    CardinalDirection,
    deepFreeze,
    createCoordinatedNode,
    RectilinearGrid,
    type RectilinearGridNode
} from '@tabletop/common'

export const StockMarketSpace = Type.Object(
    {
        id: Type.String(),
        price: Type.Integer({ minimum: 0 }),
        row: Type.Integer({ minimum: 0 }),
        column: Type.Integer({ minimum: 0 }),
        color: Type.String(),
        moves: Type.Record(Type.String(), Type.String())
    },
    { additionalProperties: false }
)
export type StockMarketSpace = Type.Static<typeof StockMarketSpace>
export const StockMarketStack = Type.Object(
    { spaceId: Type.String(), companyIds: Type.Array(Type.String()) },
    { additionalProperties: false }
)
export type StockMarketStack = Type.Static<typeof StockMarketStack>
export const StockMarket = Type.Object(
    { stacks: Type.Array(StockMarketStack) },
    { additionalProperties: false }
)
export type StockMarket = Type.Static<typeof StockMarket>

export function createRectangularStockMarketSpaces(
    rows: readonly (readonly (number | null)[])[],
    color: (row: number, column: number) => string
): StockMarketSpace[] {
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
    return spaces
}

/** A title's printed stock market; the State records only where company markers stand. */
export class StockMarketChart {
    readonly spaces: readonly StockMarketSpace[]
    private readonly spacesById: ReadonlyMap<string, StockMarketSpace>

    constructor(spaces: readonly StockMarketSpace[]) {
        const definition = Clone(spaces)
        this.spacesById = new Map(definition.map((space) => [space.id, space]))
        assert(this.spacesById.size === definition.length, 'Duplicate stock market space')
        for (const space of definition)
            for (const next of Object.values(space.moves)) this.space(next)
        deepFreeze(definition)
        this.spaces = definition
    }

    space(spaceId: string): StockMarketSpace {
        const space = this.spacesById.get(spaceId)
        assertExists(space, `Unknown stock market space: ${spaceId}`)
        return space
    }

    companySpace(market: StockMarket, companyId: string): StockMarketSpace {
        return this.space(companyMarketSpaceId(market, companyId))
    }

    move(spaceId: string, direction: string, steps: number): StockMarketSpace {
        let space = this.space(spaceId)
        for (let step = 0; step < steps; step++) {
            const next = space.moves[direction]
            if (!next) break
            space = this.space(next)
        }
        return space
    }

    placeMarker(market: StockMarket, companyId: string, spaceId: string): void {
        this.space(spaceId)
        placeStockMarker(market, companyId, spaceId)
    }

    moveCompanyMarker(
        market: StockMarket,
        companyId: string,
        direction: string,
        steps: number
    ): StockMarketMove | undefined {
        const from = this.companySpace(market, companyId)
        const to = this.move(from.id, direction, steps)
        if (to.id === from.id) return undefined
        this.placeMarker(market, companyId, to.id)
        return { companyId, fromMarketSpaceId: from.id, toMarketSpaceId: to.id }
    }

    dividendMove(market: StockMarket, companyId: string, paying: boolean): StockMarketMove {
        const from = this.companySpace(market, companyId)
        const direction = paying ? 'right' : 'left'
        const to = from.moves[direction] ?? from.moves[paying ? 'up' : 'down'] ?? from.id
        return { companyId, fromMarketSpaceId: from.id, toMarketSpaceId: to }
    }

    order(market: StockMarket): string[] {
        return [...market.stacks]
            .sort((a, b) => {
                const left = this.space(a.spaceId)
                const right = this.space(b.spaceId)
                return (
                    right.price - left.price || right.column - left.column || left.row - right.row
                )
            })
            .flatMap((stack) => stack.companyIds)
    }

    validate(market: StockMarket, companyIds: readonly string[]): void {
        assert(
            new Set(market.stacks.map((stack) => stack.spaceId)).size === market.stacks.length,
            'Duplicate market stack'
        )
        const placed = market.stacks.flatMap((stack) => stack.companyIds)
        assert(new Set(placed).size === placed.length, 'Duplicate stock market marker')
        for (const id of placed) assert(companyIds.includes(id), 'Unknown stock market company')
        for (const stack of market.stacks) this.space(stack.spaceId)
    }
}

export function companyMarketSpaceId(market: StockMarket, companyId: string): string {
    const stack = market.stacks.find((stack) => stack.companyIds.includes(companyId))
    assertExists(stack, `Company has no stock market marker: ${companyId}`)
    return stack.spaceId
}

/** Moves a company's marker to a space taken from the chart, such as a recorded move's. */
export function placeStockMarker(market: StockMarket, companyId: string, spaceId: string): void {
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

/** Returns a company's marker to a recorded space at a given place in its stack. */
export function restoreStockMarker(
    market: StockMarket,
    companyId: string,
    spaceId: string,
    index: number
): void {
    placeStockMarker(market, companyId, spaceId)
    const stack = market.stacks.find((stack) => stack.spaceId === spaceId)
    assertExists(stack, 'A placed marker has a stack')
    stack.companyIds.splice(stack.companyIds.indexOf(companyId), 1)
    stack.companyIds.splice(Math.min(index, stack.companyIds.length), 0, companyId)
}

/** A company's place in its space's stack, counting from the top. */
export function stockMarkerStackIndex(market: StockMarket, companyId: string): number {
    const stack = market.stacks.find((stack) => stack.companyIds.includes(companyId))
    assertExists(stack, `Company has no stock market marker: ${companyId}`)
    return stack.companyIds.indexOf(companyId)
}

export function removeStockMarker(market: StockMarket, companyId: string): void {
    market.stacks = market.stacks
        .map((stack) => ({
            ...stack,
            companyIds: stack.companyIds.filter((id) => id !== companyId)
        }))
        .filter((stack) => stack.companyIds.length > 0)
}

export const StockMarketMove = Type.Object(
    { companyId: Type.String(), fromMarketSpaceId: Type.String(), toMarketSpaceId: Type.String() },
    { additionalProperties: false }
)
export type StockMarketMove = Type.Static<typeof StockMarketMove>
