import { Hex, HexCoordinates, Traverser, Direction, neighborOf } from 'honeycomb-grid'
import { coordinatesToNumber } from './coordinates.js'

export function flood<T extends Hex>(options: FloodOptions): Traverser<T> {
    return function floodTraverser(createHex, _cursor) {
        const visitedHexes = new Map<number, T>()

        const startHex = createHex(options.start)
        const directions = startHex.isPointy ? POINTY_NEIGHBORS : FLAT_NEIGHBORS

        let depth = 0
        const queue: T[] = [startHex]
        visitedHexes.set(coordinatesToNumber(startHex), startHex)

        while (queue.length > 0 && (options.range === undefined || depth < options.range)) {
            const numAtCurrentDepth = queue.length
            for (let i = 0; i < numAtCurrentDepth; i++) {
                const currentHex = queue.shift()!
                for (const direction of directions) {
                    const neighbor = createHex(neighborOf(currentHex, direction))
                    if (options.canTraverse && !options.canTraverse(neighbor)) {
                        continue
                    }
                    const neighborKey = coordinatesToNumber(neighbor)
                    if (!visitedHexes.has(neighborKey)) {
                        visitedHexes.set(neighborKey, neighbor)
                        queue.push(neighbor)
                    }
                }
            }
            depth++
        }
        return [...visitedHexes.values()]
    }
}

/**
 * @category Traverser
 */
export interface FloodOptions {
    start: HexCoordinates
    range?: number
    canTraverse?: (hex: Hex) => boolean
}

const POINTY_NEIGHBORS = [
    Direction.E,
    Direction.SE,
    Direction.SW,
    Direction.W,
    Direction.NW,
    Direction.NE
]
const FLAT_NEIGHBORS = [
    Direction.N,
    Direction.NE,
    Direction.SE,
    Direction.S,
    Direction.SW,
    Direction.NW
]
