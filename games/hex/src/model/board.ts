import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, Color, Hydratable } from '@tabletop/common'
import { BoardSize } from './boardSize.js'
import { Edge, gridOf, MOST_STONES, type BoardGrid } from './cells.js'

export type StoneColor = Type.Static<typeof StoneColor>
export const StoneColor = Type.Union([Type.Literal(Color.Red), Type.Literal(Color.Blue)])

// Red joins the top and bottom edges, Blue the left and right.
export const EDGES_OF: Readonly<Record<StoneColor, readonly [Edge, Edge]>> = {
    [Color.Red]: [Edge.Top, Edge.Bottom],
    [Color.Blue]: [Edge.Left, Edge.Right]
}

// A stone's id is its place in the order of play, and the stone never moves or leaves the board.
export type Stone = Type.Static<typeof Stone>
export const Stone = Type.Object({
    id: Type.Integer({ minimum: 0, maximum: MOST_STONES - 1 }),
    // The cell the stone fills, checked against the board as it is placed.
    cell: Type.String(),
    color: StoneColor
})

export type HexBoard = Type.Static<typeof HexBoard>
export const HexBoard = Type.Object({
    size: Type.Enum(BoardSize),
    stones: Type.Array(Stone, { maxItems: MOST_STONES })
})

export function emptyBoard(size: BoardSize): HexBoard {
    return { size, stones: [] }
}

const HexBoardValidator = Compile(HexBoard)

export class HydratedHexBoard extends Hydratable<typeof HexBoard> implements HexBoard {
    declare size: BoardSize
    declare stones: Stone[]

    constructor(data: HexBoard) {
        super(data, HexBoardValidator)
    }

    get grid(): BoardGrid {
        return gridOf(this.size)
    }

    stoneAt(cell: string): Stone | undefined {
        return this.stones.find((stone) => stone.cell === cell)
    }

    isVacant(cell: string): boolean {
        return this.grid.isCell(cell) && this.stoneAt(cell) === undefined
    }

    vacantCells(): string[] {
        return this.grid.cells.filter((cell) => this.stoneAt(cell) === undefined)
    }

    place(cell: string, color: StoneColor): Stone {
        if (!this.isVacant(cell)) {
            throw Error(`${cell} is taken or off the board`)
        }
        const stone = { id: this.stones.length, cell, color }
        this.stones.push(stone)
        return stone
    }

    // The cells of the chain of one colour that holds the stone on `cell`.
    chainAt(cell: string): string[] {
        const stone = this.stoneAt(cell)
        assertExists(stone, `No stone on ${cell}`)
        const chain = new Set([cell])
        const frontier = [cell]
        for (let current = frontier.pop(); current !== undefined; current = frontier.pop()) {
            for (const neighbor of this.grid.neighborsOf(current)) {
                if (!chain.has(neighbor) && this.stoneAt(neighbor)?.color === stone.color) {
                    chain.add(neighbor)
                    frontier.push(neighbor)
                }
            }
        }
        return [...chain]
    }

    // Whether a chain of the colour joins both of that colour's edges.
    joinsEdges(chain: readonly string[], color: StoneColor): boolean {
        const reached = new Set(chain.flatMap((cell) => this.grid.edgesOf(cell)))
        return EDGES_OF[color].every((edge) => reached.has(edge))
    }

    winningChainOf(color: StoneColor): string[] | undefined {
        const seen = new Set<string>()
        for (const stone of this.stones) {
            if (stone.color !== color || seen.has(stone.cell)) continue
            const chain = this.chainAt(stone.cell)
            chain.forEach((cell) => seen.add(cell))
            if (this.joinsEdges(chain, color)) return chain
        }
        return undefined
    }
}
