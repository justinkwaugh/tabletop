import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, Color, Hydratable } from '@tabletop/common'
import { isPoint, neighborsOf, Point, POINTS, Side, sidesOf } from './points.js'

export const STONE_COUNT = POINTS.length

export type StoneColor = Type.Static<typeof StoneColor>
export const StoneColor = Type.Union([Type.Literal(Color.Black), Type.Literal(Color.White)])

// A stone's id is its place in the order of play, and the stone never moves or leaves the board.
export type Stone = Type.Static<typeof Stone>
export const Stone = Type.Object({
    id: Type.Integer({ minimum: 0, maximum: STONE_COUNT - 1 }),
    point: Point,
    color: StoneColor
})

export type YBoard = Type.Static<typeof YBoard>
export const YBoard = Type.Object({
    stones: Type.Array(Stone, { maxItems: STONE_COUNT })
})

export function emptyBoard(): YBoard {
    return { stones: [] }
}

const YBoardValidator = Compile(YBoard)

export class HydratedYBoard extends Hydratable<typeof YBoard> implements YBoard {
    declare stones: Stone[]

    constructor(data: YBoard) {
        super(data, YBoardValidator)
    }

    stoneAt(point: string): Stone | undefined {
        return this.stones.find((stone) => stone.point === point)
    }

    isVacant(point: string): boolean {
        return isPoint(point) && this.stoneAt(point) === undefined
    }

    vacantPoints(): string[] {
        return POINTS.filter((point) => this.stoneAt(point) === undefined)
    }

    isFull(): boolean {
        return this.stones.length === STONE_COUNT
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
            for (const neighbor of neighborsOf(current)) {
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
        const reached = new Set(chain.flatMap(sidesOf))
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
