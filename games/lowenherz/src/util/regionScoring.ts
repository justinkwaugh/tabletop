import { getSquare, LowenherzBoard, neighbors, squareKey, SquareType, WallEdge } from '../model/board.js'
import { Region } from '../model/region.js'

export function countTowns(region: Region, board: LowenherzBoard): number {
    return region.squareKeys.filter((key) => {
        const [col, row] = key.split(',').map(Number)
        return getSquare(board, col, row)?.type === SquareType.Village
    }).length
}

// Knights physically on the board within this region, belonging to its owner - used
// to compare a would-be invader's strength in their own region against the
// defender's, per "a player may only extend his region into another prince's region
// if the number of knights in his region exceeds that of the other prince's region."
export function countKnights(region: Region, board: LowenherzBoard): number {
    return region.squareKeys.filter((key) => {
        const [col, row] = key.split(',').map(Number)
        return getSquare(board, col, row)?.knightColor === region.ownerColor
    }).length
}

// Splits a region's squares into their maximal orthogonally-connected pieces. A
// completed region never has interior walls (removeInteriorWalls guarantees that), so
// plain adjacency within the square set is exactly connectivity - no wall lookup
// needed. Used after an invasion carves squares out of a region, to find out whether
// what's left is still all one piece or has been split, cutting some of it off from
// its castle.
export function findConnectedComponents(squareKeys: string[]): string[][] {
    const remaining = new Set(squareKeys)
    const components: string[][] = []

    for (const start of squareKeys) {
        if (!remaining.has(start)) continue

        const component: string[] = []
        const stack = [start]
        remaining.delete(start)
        while (stack.length > 0) {
            const current = stack.pop()!
            component.push(current)
            const [col, row] = current.split(',').map(Number)
            for (const n of neighbors(col, row)) {
                const nKey = squareKey(n.col, n.row)
                if (remaining.has(nKey)) {
                    remaining.delete(nKey)
                    stack.push(nKey)
                }
            }
        }
        components.push(component)
    }

    return components
}

// Region creation table from the rulebook: total spaces -> power points, plus a flat
// +5 for each town (village) space contained in the region.
export function scoreRegion(region: Region, board: LowenherzBoard): number {
    const spaceCount = region.squareKeys.length

    let points: number
    if (spaceCount <= 4) points = 3
    else if (spaceCount <= 10) points = 5
    else if (spaceCount <= 20) points = 7
    else if (spaceCount <= 30) points = 9
    else points = 12

    return points + countTowns(region, board) * 5
}

// Once a region is sealed, any wall entirely interior to it (both sides inside the
// region) is redundant clutter and gets returned to the common stock - per the
// rulebook's "the boundary walls within the new regions are removed" note. A wall on
// the region's actual outer boundary (one side in, one side out) is left alone.
export function removeInteriorWalls(board: LowenherzBoard, region: Region) {
    const squareKeys = new Set(region.squareKeys)

    board.walls = board.walls.filter((wall) => {
        const otherCol = wall.edge === WallEdge.West ? wall.col - 1 : wall.col
        const otherRow = wall.edge === WallEdge.North ? wall.row - 1 : wall.row
        const bothInside =
            squareKeys.has(squareKey(wall.col, wall.row)) && squareKeys.has(squareKey(otherCol, otherRow))
        return !bothInside
    })
}
