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
import {
    CardinalDirection,
    Hydratable,
    OffsetCoordinates,
    offsetToOffsetTuple,
    OffsetTupleCoordinates,
    offsetTupleToOffset,
    OrdinalDirection
} from '@tabletop/common'
import { FreshFishGraph } from '../util/freshFishGraph.js'

export type GameBoard = Static<typeof GameBoard>
export const GameBoard = Type.Object({
    cells: Type.Array(Type.Array(Cell))
})

export type Dimensions = [number, number]

export type InternalCorner = {
    coords: OffsetTupleCoordinates
    direction: OrdinalDirection
    dimensions: Dimensions
}
export const GameBoardValidator = TypeCompiler.Compile(GameBoard)

export interface BoardCell {
    cell: Cell
    coords: OffsetTupleCoordinates
}

export class HydratedGameBoard
    extends Hydratable<typeof GameBoard>
    implements GameBoard, Iterable<BoardCell>
{
    // I think it would have been better to represent cells as a dict internally
    // with each cell having its coordinates, but this is what was done initially
    declare cells: Cell[][]

    private internalGraph?: FreshFishGraph = undefined

    constructor(data: GameBoard) {
        super(data, GameBoardValidator)
    }

    *[Symbol.iterator](): IterableIterator<BoardCell> {
        yield* this.graph.map((node) => {
            const coords = offsetToOffsetTuple(node.coords)
            const cell = this.getCell(coords)

            if (cell) {
                return { cell, coords }
            }

            throw Error(`Cell at ${node.coords} is undefined`)
        })
    }

    get graph(): FreshFishGraph {
        if (!this.internalGraph) {
            this.internalGraph = new FreshFishGraph(this.cells)
        }
        return this.internalGraph
    }

    hasEmptyCell(): boolean {
        for (const { cell } of this) {
            if (cell.type === CellType.Empty) {
                return true
            }
        }
        return false
    }

    cellAt(coords: OffsetCoordinates): Cell | undefined {
        return this.getCell(offsetToOffsetTuple(coords))
    }

    getCell(coords: OffsetTupleCoordinates): Cell | undefined {
        const [col, row] = coords
        return this.isInBounds(coords) ? this.cells[row][col] : undefined
    }

    dimensions(): Dimensions {
        const { rows, cols } = this.graph.dimensions()
        return [cols, rows]
    }

    isInBounds(coords: OffsetTupleCoordinates): boolean {
        return this.graph.isWithinDimensions(offsetTupleToOffset(coords))
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

    isCellReservedForPlayer(coords: OffsetTupleCoordinates, playerId: string): boolean {
        const cell = this.getCell(coords)
        return cell !== undefined && this.isDiskCell(cell) && cell.playerId === playerId
    }

    setCell(coords: OffsetTupleCoordinates, cell: Cell) {
        if (!this.isInBounds(coords)) {
            throw Error(`Coordinates ${coords[0]},${coords[1]} are not in bounds`)
        }
        const [col, row] = coords
        this.cells[row][col] = cell
    }

    hasOrthogonalPiece(coords: OffsetTupleCoordinates) {
        return (
            Object.values(CardinalDirection).find((direction) => {
                return this.isPopulatedCell(this.getNeighbor(coords, direction))
            }) != undefined
        )
    }

    getNeighbor(coords: OffsetTupleCoordinates, direction: CardinalDirection): Cell | undefined {
        const neighborCoords = this.graph.neighborCoords(offsetTupleToOffset(coords), direction)
        if (!neighborCoords) {
            return undefined
        }
        return this.cellAt(neighborCoords)
    }

    getContiguousSide(direction: CardinalDirection): {
        start: OffsetTupleCoordinates
        end: OffsetTupleCoordinates
        length: number
    } {
        let side:
            | { start: OffsetTupleCoordinates; end: OffsetTupleCoordinates; length: number }
            | undefined
        switch (direction) {
            case CardinalDirection.North:
                side = this.getRowSide(0)
                break
            case CardinalDirection.South:
                side = this.getRowSide(this.cells.length - 1)
                break
            case CardinalDirection.East:
                if (this.cells[0].length > 0) {
                    side = this.getColumnSide(this.cells[0].length - 1)
                }
                break
            case CardinalDirection.West:
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
                const coords: OffsetTupleCoordinates = [x, y]

                const neighbors = {
                    [CardinalDirection.North]: this.getNeighbor(coords, CardinalDirection.North),
                    [CardinalDirection.East]: this.getNeighbor(coords, CardinalDirection.East),
                    [CardinalDirection.South]: this.getNeighbor(coords, CardinalDirection.South),
                    [CardinalDirection.West]: this.getNeighbor(coords, CardinalDirection.West)
                }

                let xLen = 0
                let yLen = 0

                let dimensions: Dimensions = [0, 0]
                switch (true) {
                    case this.isOnboardCell(neighbors[CardinalDirection.North]) &&
                        this.isOnboardCell(neighbors[CardinalDirection.West]) &&
                        (this.isOffboardCell(neighbors[CardinalDirection.South]) ||
                            !neighbors[CardinalDirection.South]) &&
                        (this.isOffboardCell(neighbors[CardinalDirection.East]) ||
                            !neighbors[CardinalDirection.East]): {
                        xLen = this.getOffboardDistance(coords, CardinalDirection.East)
                        yLen = this.getOffboardDistance(coords, CardinalDirection.South)
                        dimensions = [xLen, yLen]
                        corners.push({ coords, direction: OrdinalDirection.Northwest, dimensions })
                        break
                    }
                    case this.isOnboardCell(neighbors[CardinalDirection.North]) &&
                        this.isOnboardCell(neighbors[CardinalDirection.East]) &&
                        (this.isOffboardCell(neighbors[CardinalDirection.South]) ||
                            !neighbors[CardinalDirection.South]) &&
                        (this.isOffboardCell(neighbors[CardinalDirection.West]) ||
                            !neighbors[CardinalDirection.West]): {
                        xLen = this.getOffboardDistance(coords, CardinalDirection.West)
                        yLen = this.getOffboardDistance(coords, CardinalDirection.South)
                        dimensions = [xLen, yLen]
                        corners.push({ coords, direction: OrdinalDirection.Northeast, dimensions })
                        break
                    }
                    case this.isOnboardCell(neighbors[CardinalDirection.South]) &&
                        this.isOnboardCell(neighbors[CardinalDirection.East]) &&
                        (this.isOffboardCell(neighbors[CardinalDirection.North]) ||
                            !neighbors[CardinalDirection.North]) &&
                        (this.isOffboardCell(neighbors[CardinalDirection.West]) ||
                            !neighbors[CardinalDirection.West]): {
                        xLen = this.getOffboardDistance(coords, CardinalDirection.West)
                        yLen = this.getOffboardDistance(coords, CardinalDirection.North)
                        dimensions = [xLen, yLen]
                        corners.push({ coords, direction: OrdinalDirection.Southeast, dimensions })
                        break
                    }
                    case this.isOnboardCell(neighbors[CardinalDirection.South]) &&
                        this.isOnboardCell(neighbors[CardinalDirection.West]) &&
                        (this.isOffboardCell(neighbors[CardinalDirection.North]) ||
                            !neighbors[CardinalDirection.North]) &&
                        (this.isOffboardCell(neighbors[CardinalDirection.East]) ||
                            !neighbors[CardinalDirection.East]): {
                        xLen = this.getOffboardDistance(coords, CardinalDirection.East)
                        yLen = this.getOffboardDistance(coords, CardinalDirection.North)
                        dimensions = [xLen, yLen]
                        corners.push({ coords, direction: OrdinalDirection.Southwest, dimensions })
                        break
                    }
                }
            }
        }
        return corners
    }

    getMostSquareExternalCorner(): { coords: OffsetTupleCoordinates; direction: OrdinalDirection } {
        const xMid = Math.floor(this.dimensions()[0] / 2)
        const yMid = Math.floor(this.dimensions()[1] / 2)
        const eastLimit = xMid
        const southLimit = yMid
        const northLimit = this.dimensions()[1] - yMid - 1
        const westLimit = this.dimensions()[0] - xMid - 1

        const corners: { direction: OrdinalDirection; coords: OffsetTupleCoordinates }[] = [
            { direction: OrdinalDirection.Northwest, coords: [0, 0] },
            { direction: OrdinalDirection.Northeast, coords: [this.dimensions()[0] - 1, 0] },
            { direction: OrdinalDirection.Southwest, coords: [0, this.dimensions()[1] - 1] },
            {
                direction: OrdinalDirection.Southeast,
                coords: [this.dimensions()[0] - 1, this.dimensions()[1] - 1]
            }
        ]
        let mostSquareCorner: OffsetTupleCoordinates | undefined
        let direction = OrdinalDirection.Northwest
        let xLen = 0
        let yLen = 0

        // Almost always there is one in the actual corner
        for (const corner of corners) {
            switch (corner.direction) {
                case OrdinalDirection.Northwest: {
                    const eastCoords = this.findOnboardCell(
                        corner.coords,
                        CardinalDirection.East,
                        eastLimit
                    )
                    const southCoords = this.findOnboardCell(
                        corner.coords,
                        CardinalDirection.South,
                        southLimit
                    )

                    for (const cornerCoords of [eastCoords, southCoords].filter(
                        (coords) => coords
                    )) {
                        const eastLen = this.getOnboardCount(
                            cornerCoords!,
                            CardinalDirection.East,
                            CardinalDirection.North,
                            eastLimit
                        )
                        const southLen = this.getOnboardCount(
                            cornerCoords!,
                            CardinalDirection.South,
                            CardinalDirection.West,
                            southLimit
                        )
                        if (eastLen >= xLen && southLen >= yLen) {
                            xLen = eastLen
                            yLen = southLen
                            mostSquareCorner = cornerCoords
                            direction = corner.direction
                        }
                    }
                    break
                }
                case OrdinalDirection.Northeast: {
                    const westCoords = this.findOnboardCell(
                        corner.coords,
                        CardinalDirection.West,
                        westLimit
                    )
                    const southCoords = this.findOnboardCell(
                        corner.coords,
                        CardinalDirection.South,
                        southLimit
                    )

                    for (const cornerCoords of [westCoords, southCoords].filter(
                        (coords) => coords
                    )) {
                        const westLen = this.getOnboardCount(
                            cornerCoords!,
                            CardinalDirection.West,
                            CardinalDirection.North,
                            westLimit
                        )
                        const southLen = this.getOnboardCount(
                            cornerCoords!,
                            CardinalDirection.South,
                            CardinalDirection.East,
                            southLimit
                        )

                        if (westLen >= xLen && southLen >= yLen) {
                            xLen = westLen
                            yLen = southLen
                            mostSquareCorner = cornerCoords
                            direction = corner.direction
                        }
                    }
                    break
                }
                case OrdinalDirection.Southwest: {
                    const eastCoords = this.findOnboardCell(
                        corner.coords,
                        CardinalDirection.East,
                        eastLimit
                    )
                    const northCoords = this.findOnboardCell(
                        corner.coords,
                        CardinalDirection.North,
                        northLimit
                    )

                    for (const cornerCoords of [eastCoords, northCoords].filter(
                        (coords) => coords
                    )) {
                        const eastLen = this.getOnboardCount(
                            cornerCoords!,
                            CardinalDirection.East,
                            CardinalDirection.South,
                            eastLimit
                        )
                        const northLen = this.getOnboardCount(
                            cornerCoords!,
                            CardinalDirection.North,
                            CardinalDirection.West,
                            northLimit
                        )

                        if (eastLen >= xLen && northLen >= yLen) {
                            xLen = eastLen
                            yLen = northLen
                            mostSquareCorner = cornerCoords
                            direction = corner.direction
                        }
                    }
                    break
                }
                case OrdinalDirection.Southeast: {
                    const westCoords = this.findOnboardCell(
                        corner.coords,
                        CardinalDirection.West,
                        westLimit
                    )
                    const northCoords = this.findOnboardCell(
                        corner.coords,
                        CardinalDirection.North,
                        northLimit
                    )

                    for (const cornerCoords of [westCoords, northCoords].filter(
                        (coords) => coords
                    )) {
                        const westLen = this.getOnboardCount(
                            cornerCoords!,
                            CardinalDirection.West,
                            CardinalDirection.South,
                            westLimit
                        )
                        const northLen = this.getOnboardCount(
                            cornerCoords!,
                            CardinalDirection.North,
                            CardinalDirection.East,
                            northLimit
                        )

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
        coords: OffsetTupleCoordinates,
        direction: CardinalDirection,
        limit: number
    ): OffsetTupleCoordinates | undefined {
        let [x, y] = coords
        let cell = this.getCell([x, y])
        while (this.isOffboardCell(cell)) {
            cell = this.getNeighbor([x, y], direction)
            switch (direction) {
                case CardinalDirection.North:
                    y -= 1
                    if (y <= limit) {
                        return
                    }
                    break
                case CardinalDirection.East:
                    x += 1
                    if (x >= limit) {
                        return
                    }
                    break
                case CardinalDirection.South:
                    y += 1
                    if (y >= limit) {
                        return
                    }
                    break
                case CardinalDirection.West:
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
        coords: OffsetTupleCoordinates,
        direction: CardinalDirection,
        edge: CardinalDirection,
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
                case CardinalDirection.North:
                    y -= 1
                    if (y <= limit) {
                        atLimit = true
                    }
                    break
                case CardinalDirection.East:
                    x += 1
                    if (x >= limit) {
                        atLimit = true
                    }
                    break
                case CardinalDirection.South:
                    y += 1
                    if (y >= limit) {
                        atLimit = true
                    }
                    break
                case CardinalDirection.West:
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

    private getOffboardDistance(
        coords: OffsetTupleCoordinates,
        direction: CardinalDirection
    ): number {
        let distance = 0
        let [x, y] = coords
        let cell = this.getCell([x, y])
        while (this.isOffboardCell(cell)) {
            distance += 1
            cell = this.getNeighbor([x, y], direction)
            switch (direction) {
                case CardinalDirection.North:
                    y -= 1
                    break
                case CardinalDirection.East:
                    x += 1
                    break
                case CardinalDirection.South:
                    y += 1
                    break
                case CardinalDirection.West:
                    x -= 1
                    break
            }
        }
        return distance
    }

    private getColumnSide(
        col: number
    ): { start: OffsetTupleCoordinates; end: OffsetTupleCoordinates; length: number } | undefined {
        let length = 0
        let start: OffsetTupleCoordinates | undefined
        let end: OffsetTupleCoordinates | undefined

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
    ): { start: OffsetTupleCoordinates; end: OffsetTupleCoordinates; length: number } | undefined {
        let length = 0
        let start: OffsetTupleCoordinates | undefined
        let end: OffsetTupleCoordinates | undefined

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
