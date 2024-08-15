import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import {
    CellType,
    Cell,
    PopulatedCell,
    PopulatedCellTypes,
    DiskCell,
    OffBoardCell,
    EmptyCell
} from '../components/cells.js'
import { Hydratable } from '@tabletop/common'

// This should be made more common
export type Coordinates = Static<typeof Coordinates>
export const Coordinates = Type.Tuple([Type.Number(), Type.Number()])

export type GameBoard = Static<typeof GameBoard>
export const GameBoard = Type.Object({
    cells: Type.Array(Type.Array(Cell))
})

export type Point = { x: number; y: number }
export type Dimensions = [number, number]

export type InternalCorner = {
    coords: Coordinates
    direction: Direction
    dimensions: Dimensions
}
export const GameBoardValidator = TypeCompiler.Compile(GameBoard)

export enum Direction {
    North = 0,
    NorthEast = 1,
    East = 2,
    SouthEast = 3,
    South = 4,
    SouthWest = 5,
    West = 6,
    NorthWest = 7
}

export const DirectionName = {
    [Direction.North]: 'North',
    [Direction.NorthEast]: 'NorthEast',
    [Direction.East]: 'East',
    [Direction.SouthEast]: 'SouthEast',
    [Direction.South]: 'South',
    [Direction.SouthWest]: 'SouthWest',
    [Direction.West]: 'West',
    [Direction.NorthWest]: 'NorthWest'
}

export interface BoardCell {
    cell: Cell
    coords: Coordinates
}

export class HydratedGameBoard
    extends Hydratable<typeof GameBoard>
    implements GameBoard, Iterable<BoardCell>
{
    declare cells: Cell[][]

    constructor(data: GameBoard) {
        super(data, GameBoardValidator)
    }

    [Symbol.iterator](): Iterator<BoardCell> {
        let row = 0
        let col = 0
        return {
            next: () => {
                if (row >= this.cells.length) {
                    return { done: true, value: undefined }
                }
                const coords: Coordinates = [col, row]
                const cell = this.getCell([col, row])

                if (!cell) {
                    throw Error(`Cell at ${col},${row} is undefined`)
                }
                col += 1
                if (col >= this.cells[row].length) {
                    col = 0
                    row += 1
                }
                return { done: false, value: { cell, coords } }
            }
        }
    }

    getCell(coords: Coordinates): Cell | undefined {
        const [col, row] = coords
        return this.isInBounds(coords) ? this.cells[row][col] : undefined
    }

    dimensions(): Dimensions {
        return [this.cells.length > 0 ? this.cells[0].length : 0, this.cells.length]
    }

    isInBounds(coords: Coordinates): boolean {
        return (
            coords[1] >= 0 &&
            coords[1] < this.cells.length &&
            coords[0] >= 0 &&
            coords[0] < this.cells[0].length
        )
    }

    isEmptyCell(cell?: Cell): cell is EmptyCell {
        if (!cell) {
            return false
        }
        return cell.type === CellType.Empty
    }

    isOffboardCell(cell?: Cell): cell is OffBoardCell {
        if (!cell) {
            return false
        }
        return cell.type === CellType.OffBoard
    }

    isOnboardCell(cell?: Cell): boolean {
        if (!cell) {
            return false
        }
        return cell.type !== CellType.OffBoard
    }

    isPopulatedCell(cell?: Cell): cell is PopulatedCell {
        if (!cell) {
            return false
        }
        return PopulatedCellTypes.includes(cell.type)
    }

    isDiskCell(cell: Cell): cell is DiskCell {
        return cell.type === CellType.Disk
    }

    isCellReservedForPlayer(coords: Coordinates, playerId: string): boolean {
        const cell = this.getCell(coords)
        return cell !== undefined && this.isDiskCell(cell) && cell.playerId === playerId
    }

    setCell(coords: Coordinates, cell: Cell) {
        if (!this.isInBounds(coords)) {
            throw Error(`Coordinates ${coords[0]},${coords[1]} are not in bounds`)
        }
        const [col, row] = coords
        this.cells[row][col] = cell
    }

    hasOrthogonalTile(coords: Coordinates) {
        return (
            [Direction.North, Direction.East, Direction.South, Direction.West].find((direction) => {
                return this.isPopulatedCell(this.getNeighbor(coords, direction))
            }) != undefined
        )
    }

    getNeighbor(coords: Coordinates, direction: Direction): Cell | undefined {
        const neighborCoords = this.getNeighborCoords(coords, direction)
        if (!neighborCoords) {
            return undefined
        }
        return this.getCell(neighborCoords)
    }

    getNeighborCoords(coords: Coordinates, direction: Direction): Coordinates | undefined {
        if (!this.isInBounds(coords)) {
            return undefined
        }

        const [col, row] = coords
        switch (direction) {
            case Direction.North: {
                return [col, row - 1]
            }
            case Direction.East: {
                return [col + 1, row]
            }
            case Direction.South: {
                return [col, row + 1]
            }
            case Direction.West: {
                return [col - 1, row]
            }
            default: {
                throw Error(`Invalid direction ${direction}`)
            }
        }
    }

    getContiguousSide(direction: Direction): {
        start: Coordinates
        end: Coordinates
        length: number
    } {
        let side: { start: Coordinates; end: Coordinates; length: number } | undefined

        switch (direction) {
            case Direction.North:
                side = this.getRowSide(0)
                break
            case Direction.South:
                side = this.getRowSide(this.cells.length - 1)
                break
            case Direction.East:
                if (this.cells[0].length > 0) {
                    side = this.getColumnSide(this.cells[0].length - 1)
                }
                break
            case Direction.West:
                if (this.cells[0].length > 0) {
                    side = this.getColumnSide(0)
                }
                break
        }

        return side ?? { start: [0, 0], end: [0, 0], length: 0 }
    }

    getDeepestInternalCorner(): InternalCorner | undefined {
        let deepestCorner: InternalCorner | undefined
        for (const corner of this.getInternalCorners()) {
            if (
                !deepestCorner ||
                (corner &&
                    (corner.dimensions[0] >= deepestCorner.dimensions[0] ||
                        corner.dimensions[1] >= deepestCorner.dimensions[1]) &&
                    corner.dimensions[0] * corner.dimensions[1] >
                        deepestCorner.dimensions[0] * deepestCorner.dimensions[1])
            ) {
                deepestCorner = corner
            }
        }
        return deepestCorner
    }

    getInternalCorners(): InternalCorner[] {
        const corners: InternalCorner[] = []

        for (let y = 0; y < this.cells.length; y++) {
            for (let x = 0; x < this.cells[y].length; x++) {
                const cell = this.cells[y][x]
                if (cell.type !== CellType.OffBoard) {
                    continue
                }
                const coords: Coordinates = [x, y]

                const neighbors = {
                    [Direction.North]: this.getNeighbor(coords, Direction.North),
                    [Direction.East]: this.getNeighbor(coords, Direction.East),
                    [Direction.South]: this.getNeighbor(coords, Direction.South),
                    [Direction.West]: this.getNeighbor(coords, Direction.West)
                }

                let xLen = 0
                let yLen = 0
                let direction = Direction.North
                let dimensions: Dimensions = [0, 0]
                switch (true) {
                    case this.isOnboardCell(neighbors[Direction.North]) &&
                        this.isOnboardCell(neighbors[Direction.West]) &&
                        (this.isOffboardCell(neighbors[Direction.South]) ||
                            !neighbors[Direction.South]) &&
                        (this.isOffboardCell(neighbors[Direction.East]) ||
                            !neighbors[Direction.East]): {
                        xLen = this.getOffboardDistance(coords, Direction.East)
                        yLen = this.getOffboardDistance(coords, Direction.South)
                        direction = Direction.NorthWest
                        dimensions = [xLen, yLen]
                        corners.push({ coords, direction, dimensions })
                        break
                    }
                    case this.isOnboardCell(neighbors[Direction.North]) &&
                        this.isOnboardCell(neighbors[Direction.East]) &&
                        (this.isOffboardCell(neighbors[Direction.South]) ||
                            !neighbors[Direction.South]) &&
                        (this.isOffboardCell(neighbors[Direction.West]) ||
                            !neighbors[Direction.West]): {
                        xLen = this.getOffboardDistance(coords, Direction.West)
                        yLen = this.getOffboardDistance(coords, Direction.South)
                        direction = Direction.NorthEast
                        dimensions = [xLen, yLen]
                        corners.push({ coords, direction, dimensions })
                        break
                    }
                    case this.isOnboardCell(neighbors[Direction.South]) &&
                        this.isOnboardCell(neighbors[Direction.East]) &&
                        (this.isOffboardCell(neighbors[Direction.North]) ||
                            !neighbors[Direction.North]) &&
                        (this.isOffboardCell(neighbors[Direction.West]) ||
                            !neighbors[Direction.West]): {
                        xLen = this.getOffboardDistance(coords, Direction.West)
                        yLen = this.getOffboardDistance(coords, Direction.North)
                        direction = Direction.SouthEast
                        dimensions = [xLen, yLen]
                        corners.push({ coords, direction, dimensions })
                        break
                    }
                    case this.isOnboardCell(neighbors[Direction.South]) &&
                        this.isOnboardCell(neighbors[Direction.West]) &&
                        (this.isOffboardCell(neighbors[Direction.North]) ||
                            !neighbors[Direction.North]) &&
                        (this.isOffboardCell(neighbors[Direction.East]) ||
                            !neighbors[Direction.East]): {
                        xLen = this.getOffboardDistance(coords, Direction.East)
                        yLen = this.getOffboardDistance(coords, Direction.North)
                        direction = Direction.SouthWest
                        dimensions = [xLen, yLen]
                        corners.push({ coords, direction, dimensions })
                        break
                    }
                }
            }
        }
        return corners
    }

    getMostSquareExternalCorner(): { coords: Coordinates; direction: Direction } {
        const xMid = Math.floor(this.dimensions()[0] / 2)
        const yMid = Math.floor(this.dimensions()[1] / 2)
        const eastLimit = xMid
        const southLimit = yMid
        const northLimit = this.dimensions()[1] - yMid - 1
        const westLimit = this.dimensions()[0] - xMid - 1

        const corners: { direction: Direction; coords: Coordinates }[] = [
            { direction: Direction.NorthWest, coords: [0, 0] },
            { direction: Direction.NorthEast, coords: [this.dimensions()[0] - 1, 0] },
            { direction: Direction.SouthWest, coords: [0, this.dimensions()[1] - 1] },
            {
                direction: Direction.SouthEast,
                coords: [this.dimensions()[0] - 1, this.dimensions()[1] - 1]
            }
        ]
        let mostSquareCorner: Coordinates | undefined
        let direction = Direction.NorthWest
        let xLen = 0
        let yLen = 0

        // Almost always there is one in the actual corner
        for (const corner of corners) {
            switch (corner.direction) {
                case Direction.NorthWest: {
                    const eastCoords = this.findOnboardCell(
                        corner.coords,
                        Direction.East,
                        eastLimit
                    )
                    const southCoords = this.findOnboardCell(
                        corner.coords,
                        Direction.South,
                        southLimit
                    )
                    console.log('NW: East: ', eastCoords, 'South: ', southCoords)

                    for (const cornerCoords of [eastCoords, southCoords].filter(
                        (coords) => coords
                    )) {
                        const eastLen = this.getOnboardCount(
                            cornerCoords!,
                            Direction.East,
                            Direction.North,
                            eastLimit
                        )
                        const southLen = this.getOnboardCount(
                            cornerCoords!,
                            Direction.South,
                            Direction.West,
                            southLimit
                        )
                        console.log('NW: ', eastLen, southLen)
                        if (eastLen >= xLen && southLen >= yLen) {
                            xLen = eastLen
                            yLen = southLen
                            mostSquareCorner = cornerCoords
                            direction = corner.direction
                        }
                    }
                    break
                }
                case Direction.NorthEast: {
                    const westCoords = this.findOnboardCell(
                        corner.coords,
                        Direction.West,
                        westLimit
                    )
                    const southCoords = this.findOnboardCell(
                        corner.coords,
                        Direction.South,
                        southLimit
                    )
                    console.log('NE: West: ', westCoords, 'South: ', southCoords)
                    for (const cornerCoords of [westCoords, southCoords].filter(
                        (coords) => coords
                    )) {
                        const westLen = this.getOnboardCount(
                            cornerCoords!,
                            Direction.West,
                            Direction.North,
                            westLimit
                        )
                        const southLen = this.getOnboardCount(
                            cornerCoords!,
                            Direction.South,
                            Direction.East,
                            southLimit
                        )
                        console.log('NE: ', westLen, southLen)
                        if (westLen >= xLen && southLen >= yLen) {
                            xLen = westLen
                            yLen = southLen
                            mostSquareCorner = cornerCoords
                            direction = corner.direction
                        }
                    }
                    break
                }
                case Direction.SouthWest: {
                    const eastCoords = this.findOnboardCell(
                        corner.coords,
                        Direction.East,
                        eastLimit
                    )
                    const northCoords = this.findOnboardCell(
                        corner.coords,
                        Direction.North,
                        northLimit
                    )
                    console.log('SW: East: ', eastCoords, 'North: ', northCoords)
                    for (const cornerCoords of [eastCoords, northCoords].filter(
                        (coords) => coords
                    )) {
                        const eastLen = this.getOnboardCount(
                            cornerCoords!,
                            Direction.East,
                            Direction.South,
                            eastLimit
                        )
                        const northLen = this.getOnboardCount(
                            cornerCoords!,
                            Direction.North,
                            Direction.West,
                            northLimit
                        )
                        console.log('SW: ', eastLen, northLen)
                        if (eastLen >= xLen && northLen >= yLen) {
                            xLen = eastLen
                            yLen = northLen
                            mostSquareCorner = cornerCoords
                            direction = corner.direction
                        }
                    }
                    break
                }
                case Direction.SouthEast: {
                    const westCoords = this.findOnboardCell(
                        corner.coords,
                        Direction.West,
                        westLimit
                    )
                    const northCoords = this.findOnboardCell(
                        corner.coords,
                        Direction.North,
                        northLimit
                    )
                    console.log('SE: West: ', westCoords, 'North: ', northCoords)
                    for (const cornerCoords of [westCoords, northCoords].filter(
                        (coords) => coords
                    )) {
                        const westLen = this.getOnboardCount(
                            cornerCoords!,
                            Direction.West,
                            Direction.South,
                            westLimit
                        )
                        const northLen = this.getOnboardCount(
                            cornerCoords!,
                            Direction.North,
                            Direction.East,
                            northLimit
                        )
                        console.log('SE: ', westLen, northLen)
                        if (westLen >= xLen && northLen >= yLen) {
                            xLen = westLen
                            yLen = northLen
                            mostSquareCorner = cornerCoords
                            direction = corner.direction
                        }
                    }
                    break
                }
            }
        }
        if (!mostSquareCorner) {
            throw Error('Could not find most square corner')
        }

        return { coords: mostSquareCorner, direction }
    }

    private findOnboardCell(
        coords: Coordinates,
        direction: Direction,
        limit: number
    ): Coordinates | undefined {
        let [x, y] = coords
        let cell = this.getCell([x, y])
        while (this.isOffboardCell(cell)) {
            cell = this.getNeighbor([x, y], direction)
            switch (direction) {
                case Direction.North:
                    y -= 1
                    if (y <= limit) {
                        return
                    }
                    break
                case Direction.East:
                    x += 1
                    if (x >= limit) {
                        return
                    }
                    break
                case Direction.South:
                    y += 1
                    if (y >= limit) {
                        return
                    }
                    break
                case Direction.West:
                    x -= 1
                    if (x <= limit) {
                        return
                    }
                    break
            }
        }

        return this.isEmptyCell(cell) ? [x, y] : undefined
    }

    private getOnboardCount(
        coords: Coordinates,
        direction: Direction,
        edge: Direction,
        limit: number
    ): number {
        let distance = 0
        let [x, y] = coords
        let cell = this.getCell([x, y])
        let neighbor = this.getNeighbor([x, y], edge)
        let atLimit = false
        while (!atLimit && cell && !this.isOffboardCell(cell) && !this.isEmptyCell(neighbor)) {
            distance += 1
            cell = this.getNeighbor([x, y], direction)
            switch (direction) {
                case Direction.North:
                    y -= 1
                    if (y <= limit) {
                        atLimit = true
                    }
                    break
                case Direction.East:
                    x += 1
                    if (x >= limit) {
                        atLimit = true
                    }
                    break
                case Direction.South:
                    y += 1
                    if (y >= limit) {
                        atLimit = true
                    }
                    break
                case Direction.West:
                    x -= 1
                    if (x <= limit) {
                        atLimit = true
                    }
                    break
            }
            neighbor = this.getNeighbor([x, y], edge)
        }

        return distance
    }

    private getOffboardDistance(coords: Coordinates, direction: Direction): number {
        let distance = 0
        let [x, y] = coords
        let cell = this.getCell([x, y])
        while (this.isOffboardCell(cell)) {
            distance += 1
            cell = this.getNeighbor([x, y], direction)
            switch (direction) {
                case Direction.North:
                    y -= 1
                    break
                case Direction.East:
                    x += 1
                    break
                case Direction.South:
                    y += 1
                    break
                case Direction.West:
                    x -= 1
                    break
            }
        }
        return distance
    }

    private getColumnSide(
        col: number
    ): { start: Coordinates; end: Coordinates; length: number } | undefined {
        let length = 0
        let start: Coordinates | undefined
        let end: Coordinates | undefined

        for (let i = 0; i < this.cells.length; i++) {
            const cell = this.cells[i][col]
            if (cell.type !== CellType.OffBoard) {
                if (!start) {
                    start = [col, i]
                }

                if (end) {
                    // non-contiguous
                    return
                }

                length += 1
            }
            if (cell.type === CellType.OffBoard && start) {
                end = [col, i - 1]
            }
        }

        if (start && !end) {
            end = [col, this.cells.length - 1]
        }

        if (!start || !end) {
            return
        }

        return { start, end, length }
    }

    private getRowSide(
        row: number
    ): { start: Coordinates; end: Coordinates; length: number } | undefined {
        let length = 0
        let start: Coordinates | undefined
        let end: Coordinates | undefined

        if (this.cells.length === 0) {
            return
        }

        for (let i = 0; i < this.cells[row].length; i++) {
            const cell = this.cells[row][i]
            if (cell.type !== CellType.OffBoard) {
                if (!start) {
                    start = [i, row]
                }
                if (end) {
                    // non-contiguous
                    return
                }
                length += 1
            } else if (cell.type === CellType.OffBoard && start) {
                end = [i - 1, row]
            }
        }
        if (start && !end) {
            end = [this.cells[row].length - 1, row]
        }

        if (!start || !end) {
            return
        }

        return { start, end, length }
    }
}
