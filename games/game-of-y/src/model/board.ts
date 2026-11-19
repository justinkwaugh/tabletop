import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, Color, Hydratable } from '@tabletop/common'
import { Side } from './points.js'
import { BoardShape, gridOf, MOST_STONES, type BoardGrid } from './grids.js'

export type StoneColor = Type.Static<typeof StoneColor>
export const StoneColor = Type.Union([Type.Literal(Color.Black), Type.Literal(Color.White)])

// A stone's id is its place in the order of play, and the stone never moves or leaves the board.
export type Stone = Type.Static<typeof Stone>
export const Stone = Type.Object({
    id: Type.Integer({ minimum: 0, maximum: MOST_STONES - 1 }),
    // A point of the board the stone is on, checked against that board as it is placed.
    point: Type.String(),
    color: StoneColor
})

export type YBoard = Type.Static<typeof YBoard>
export const YBoard = Type.Object({
    shape: Type.Enum(BoardShape),
    stones: Type.Array(Stone, { maxItems: MOST_STONES })
})

export function emptyBoard(shape: BoardShape): YBoard {
    return { shape, stones: [] }
}

const YBoardValidator = Compile(YBoard)

export class HydratedYBoard extends Hydratable<typeof YBoard> implements YBoard {
    declare shape: BoardShape
    declare stones: Stone[]

    constructor(data: YBoard) {
        super(data, YBoardValidator)
    }

    get grid(): BoardGrid {
        return gridOf(this.shape)
    }

    stoneAt(point: string): Stone | undefined {
        return this.stones.find((stone) => stone.point === point)
    }

    isVacant(point: string): boolean {
        return this.grid.isPoint(point) && this.stoneAt(point) === undefined
    }

    vacantPoints(): string[] {
        return this.grid.points.filter((point) => this.stoneAt(point) === undefined)
    }

    isFull(): boolean {
        return this.stones.length === this.grid.points.length
    }

    place(point: string, color: StoneColor): Stone {
        if (!this.isVacant(point)) {
            throw Error(`${point} is taken or off the board`)
        }
        const stone = { id: this.stones.length, point, color }
        this.stones.push(stone)
        return stone
    }

    // The points of the chain of one colour that holds the stone on `point`.
    chainAt(point: string): string[] {
        const stone = this.stoneAt(point)
        assertExists(stone, `No stone on ${point}`)
        const chain = new Set([point])
        const frontier = [point]
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

    // A Y: one chain reaching all three sides, a corner counting for both of its sides.
    formsY(chain: readonly string[]): boolean {
        const reached = new Set(chain.flatMap((point) => this.grid.sidesOf(point)))
        return Object.values(Side).every((side) => reached.has(side))
    }

    yChainOf(color: StoneColor): string[] | undefined {
        const seen = new Set<string>()
        for (const stone of this.stones) {
            if (stone.color !== color || seen.has(stone.point)) continue
            const chain = this.chainAt(stone.point)
            chain.forEach((point) => seen.add(point))
            if (this.formsY(chain)) return chain
        }
        return undefined
    }
}
