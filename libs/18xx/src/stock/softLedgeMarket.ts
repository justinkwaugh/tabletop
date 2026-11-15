import { assertExists } from '@tabletop/common'
import type { StockRules } from './stockRules.js'
import {
    createRectangularStockMarketSpaces,
    StockMarketChart,
    type StockMarketSpace
} from './stockMarket.js'

export type SoftLedgeEdge = { spaceId: string; side: 'bottom' | 'right' }

/**
 * A market divided by a soft ledge, as in 1832, 1850 and 1870. Each cell is its price, then its
 * zone letter if any, then `i` below the ledge. A price enters the lower area only by falling
 * through the ledge: a sale with one space left to fall stops on it, and a rightward move meeting
 * it goes up. A token at the top moves right and down instead of up.
 */
export class SoftLedgeMarket {
    readonly chart: StockMarketChart
    readonly ledge: readonly SoftLedgeEdge[]
    readonly topRowPrices: readonly number[]
    private readonly lowerAreaSpaceIds: ReadonlySet<string>

    constructor(rows: readonly string[], zones: Readonly<Record<string, string>>) {
        const cells = rows.map((row) => row.split(' '))
        const lower = (cell: string | undefined) => !!cell?.endsWith('i')
        this.lowerAreaSpaceIds = new Set(
            cells.flatMap((row, rowIndex) =>
                row.flatMap((cell, column) => (lower(cell) ? [`${rowIndex}:${column}`] : []))
            )
        )
        this.ledge = cells.flatMap((row, rowIndex) =>
            row.flatMap((cell, column) => {
                if (lower(cell)) return []
                return [
                    ...(lower(cells[rowIndex + 1]?.[column]) ? (['bottom'] as const) : []),
                    ...(lower(row[column + 1]) ? (['right'] as const) : [])
                ].map((side) => ({ spaceId: `${rowIndex}:${column}`, side }))
            })
        )
        this.topRowPrices = cells[0].map((cell) => Number.parseInt(cell))
        const spaces = createRectangularStockMarketSpaces(
            cells.map((row) => row.map((cell) => Number.parseInt(cell))),
            (row, column) => zones[cells[row][column].replace(/[\di]/g, '')] ?? 'white'
        )
        this.divertMoves(spaces)
        this.chart = new StockMarketChart(spaces)
    }

    private divertMoves(spaces: StockMarketSpace[]): void {
        const spacesById = new Map(spaces.map((space) => [space.id, space]))
        const spaceById = (id: string) => {
            const space = spacesById.get(id)
            assertExists(space, `Unknown stock market space: ${id}`)
            return space
        }
        for (const space of spaces) {
            const right = space.moves.right && spaceById(space.moves.right)
            if (right && !this.isLowerArea(space) && this.isLowerArea(right)) {
                if (space.moves.up) space.moves.right = space.moves.up
                else delete space.moves.right
            }
            if (space.row === 0 && space.moves.right) {
                const diagonal = spaceById(space.moves.right).moves.down
                if (diagonal) space.moves.up = diagonal
            }
        }
    }

    isLowerArea(space: StockMarketSpace): boolean {
        return this.lowerAreaSpaceIds.has(space.id)
    }

    saleDescent(spaceId: string, shares: number): number {
        let space = this.chart.space(spaceId)
        let spaces = 0
        for (let remaining = shares; remaining > 0; remaining--) {
            const below = space.moves.down
            if (!below) break
            const next = this.chart.space(below)
            if (remaining === 1 && !this.isLowerArea(space) && this.isLowerArea(next)) break
            space = next
            spaces++
        }
        return spaces
    }

    withSaleDescent(saleTerms: StockRules['saleTerms']): StockRules['saleTerms'] {
        return (state, companyId, shares, seller) => {
            const terms = saleTerms(state, companyId, shares, seller)
            if (typeof terms === 'string') return terms
            const from = this.chart.companySpace(state.stockMarket, companyId)
            return { ...terms, movement: this.saleDescent(from.id, shares) }
        }
    }
}
