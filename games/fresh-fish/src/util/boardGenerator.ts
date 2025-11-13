import { type RandomFunction, shuffle } from '@tabletop/common'
import { Cell, CellType, RoadCell, TruckCell } from '../components/cells.js'
import {
    Direction,
    HydratedGameBoard,
    type InternalCorner,
    type Point,
    type Dimensions,
    DirectionName
} from '../components/gameBoard.js'
import { GoodsType } from '../definition/goodsType.js'
import chalk from 'chalk'
import { LogColorizer } from './logColorizer.js'
import { logBoard } from './stateLogger.js'
import { Expropriator } from './expropriation.js'

const PlayerStallRegex = /S[FCIL][12345]/
const PlayerDiskRegex = /D[12345]/
const TruckRegex = /T[FCIL]/

type BoardTile = {
    dimensions: Dimensions
    marketCount: number
}

const BoardTiles: BoardTile[] = [
    { dimensions: [3, 4], marketCount: 2 },
    { dimensions: [3, 6], marketCount: 3 },
    { dimensions: [4, 4], marketCount: 3 },
    { dimensions: [4, 4], marketCount: 3 },
    { dimensions: [3, 5], marketCount: 3 },
    { dimensions: [4, 5], marketCount: 4 },
    { dimensions: [3, 7], marketCount: 5 }
]

const colorsByIndex = [
    chalk.cyanBright,
    chalk.redBright,
    chalk.greenBright,
    chalk.yellowBright,
    chalk.magentaBright
]
const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5']
const colorFuncs = new Map(playerIds.map((id, index) => [id, colorsByIndex[index]]))
const colorizer = new LogColorizer(colorFuncs)

export function generateBoard(
    numPlayers: number,
    random: RandomFunction
): { board: HydratedGameBoard; numMarketTiles: number } {
    let boardData = { board: new HydratedGameBoard({ cells: [] }), numMarketTiles: 0 }

    do {
        boardData = layoutBoard(numPlayers, random)
    } while (!isValidBoard(boardData.board))

    placeTrucks(boardData.board, random)
    expropriate(boardData.board)

    logBoard(boardData.board, colorizer)

    return boardData
}

function expropriate(board: HydratedGameBoard) {
    const expropriator = new Expropriator(board)
    const { expropriatedCoords } = expropriator.calculateExpropriation()
    for (const coords of expropriatedCoords) {
        const roadCell: RoadCell = { type: CellType.Road }
        board.setCell(coords, roadCell)
    }
}

function isValidBoard(board: HydratedGameBoard): boolean {
    // check quadrants
    const xMid = Math.floor(board.dimensions()[0] / 2)
    const yMid = Math.floor(board.dimensions()[1] / 2)

    if (isQuadrantBlank(0, xMid, 0, yMid, board)) {
        return false
    }
    if (isQuadrantBlank(xMid, board.dimensions()[0], 0, yMid, board)) {
        return false
    }
    if (isQuadrantBlank(0, xMid, yMid, board.dimensions()[1], board)) {
        return false
    }
    if (isQuadrantBlank(xMid, board.dimensions()[0], yMid, board.dimensions()[1], board)) {
        return false
    }

    // check squareness
    if (Math.abs(board.dimensions()[0] - board.dimensions()[1]) > 3) {
        return false
    }
    return true
}

function isQuadrantBlank(
    startX: number,
    endX: number,
    startY: number,
    endY: number,
    board: HydratedGameBoard
): boolean {
    for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
            const cell = board.getCell([x, y])
            if (board.isEmptyCell(cell)) {
                return false
            }
        }
    }
    return true
}

export function layoutBoard(
    numPlayers: number,
    random: RandomFunction
): { board: HydratedGameBoard; numMarketTiles: number } {
    const randomizedTiles = structuredClone(BoardTiles)

    let chosenTiles: BoardTile[] = []
    let validChoice = false
    while (!validChoice) {
        shuffle(randomizedTiles, random)
        chosenTiles = randomizedTiles.slice(0, numPlayers + 1)
        validChoice = isValidMarketTotal(chosenTiles, numPlayers)
    }

    // chosenTiles.sort((a, b) => Math.max(...b.dimensions) - Math.max(...a.dimensions))
    // chosenTiles.reverse()
    console.log('Chosen tiles:')
    chosenTiles.forEach((tile, index) => {
        console.log(
            `Tile ${index + 1}: ${tile.dimensions[0]}x${tile.dimensions[1]} Markets: ${tile.marketCount}`
        )
    })

    console.log('Start Layout')
    let currentBoard: HydratedGameBoard = new HydratedGameBoard({ cells: [] })

    for (let i = 0; i < chosenTiles.length; i++) {
        const tile = chosenTiles[i]

        console.log('New Tile Dimensions: ', tile.dimensions)
        const boardCorner: Point = { x: 0, y: 0 }

        const options = []

        if (i === 0) {
            // Pick random orientation for first tile
            if (Math.round(random())) {
                tile.dimensions.reverse()
            }

            options.push({
                point: boardCorner,
                tileDimensions: tile.dimensions,
                data: getOffsetsAndDimensions(
                    boardCorner,
                    boardCorner,
                    currentBoard.dimensions(),
                    tile.dimensions
                )
            })
        }

        if (i >= 1) {
            const longestSide = findLongestSide(currentBoard, random)
            console.log('Longest Side: ', DirectionName[longestSide])
            const regularDimensions: Dimensions = [tile.dimensions[0], tile.dimensions[1]]
            const allowNegative = i < chosenTiles.length - 1
            const startPoint = getStartPointForEdge(
                currentBoard,
                longestSide,
                regularDimensions,
                allowNegative,
                random
            )
            options.push({
                point: startPoint,
                tileDimensions: regularDimensions,
                data: getOffsetsAndDimensions(
                    boardCorner,
                    startPoint,
                    currentBoard.dimensions(),
                    regularDimensions
                )
            })
            console.log('Edge Start Point: ', startPoint.x, startPoint.y)
            console.log('Edge Tile Dimensions: ', regularDimensions)

            const reversedDimensions: Dimensions = [tile.dimensions[1], tile.dimensions[0]]
            const reversedStartPoint = getStartPointForEdge(
                currentBoard,
                longestSide,
                reversedDimensions,
                allowNegative,
                random
            )

            options.push({
                point: reversedStartPoint,
                tileDimensions: reversedDimensions,
                data: getOffsetsAndDimensions(
                    boardCorner,
                    reversedStartPoint,
                    currentBoard.dimensions(),
                    reversedDimensions
                )
            })
            console.log('Edge Start Point: ', reversedStartPoint.x, reversedStartPoint.y)
            console.log('Edge Tile Dimensions: ', reversedDimensions)
        }

        if (i > 1) {
            // Try internal corners
            for (const corner of currentBoard.getInternalCorners()) {
                console.log('Corner: ', corner)

                // Try the tile both ways
                const regularDimensions: Dimensions = [tile.dimensions[0], tile.dimensions[1]]
                const startPoint = getStartPointForCorner(corner, regularDimensions)
                options.push({
                    point: startPoint,
                    tileDimensions: regularDimensions,
                    data: getOffsetsAndDimensions(
                        boardCorner,
                        startPoint,
                        currentBoard.dimensions(),
                        regularDimensions
                    )
                })
                console.log('Corner Start Point: ', startPoint.x, startPoint.y)
                console.log('Corner Tile Dimensions: ', regularDimensions)

                const reversedDimensions: Dimensions = [tile.dimensions[1], tile.dimensions[0]]
                const reversedStartPoint = getStartPointForCorner(corner, reversedDimensions)
                options.push({
                    point: reversedStartPoint,
                    tileDimensions: reversedDimensions,
                    data: getOffsetsAndDimensions(
                        boardCorner,
                        reversedStartPoint,
                        currentBoard.dimensions(),
                        reversedDimensions
                    )
                })
                console.log('Corner Start Point: ', reversedStartPoint.x, reversedStartPoint.y)
                console.log('Corner Tile Dimensions: ', reversedDimensions)
            }
        }

        const {
            point: newPoint,
            tileDimensions,
            data: { xOffset, yOffset, width, height }
        } = options.reduce((acc, curr) => {
            const newSquareness = Math.abs(curr.data.width - curr.data.height)
            const newArea = curr.data.width * curr.data.height

            const existingSquareness = Math.abs(acc.data.width - acc.data.height)
            const existingArea = acc.data.width * acc.data.height

            // This is pretty meh, but it tries to favor either squareness or area depending on the situation
            if (
                newArea < existingArea &&
                (existingArea - newArea > 8 || Math.abs(newSquareness - existingSquareness) <= 1)
            ) {
                return curr
            } else if (
                newSquareness < existingSquareness &&
                (newArea < existingArea || newArea - existingArea < 20)
            ) {
                return curr
            } else {
                return acc
            }
        })

        console.log('New Board Dimensions: ', width, height)
        console.log('New Tile Dimensions: ', tileDimensions)
        console.log('New Start Point: ', newPoint.x, newPoint.y)
        console.log('Offsets: ', xOffset, yOffset)

        const newCells = generateNewBoardWithTile({
            currentBoard,
            newBoardWidth: width,
            newBoardHeight: height,
            xOffset,
            yOffset,
            tileDimensions,
            startPoint: newPoint
        })

        currentBoard = new HydratedGameBoard({ cells: newCells })
        logBoard(currentBoard, colorizer)
    }

    return {
        board: currentBoard,
        numMarketTiles: chosenTiles.reduce((acc, tile) => acc + tile.marketCount, 0)
    }
}

function generateNewBoardWithTile({
    currentBoard,
    newBoardWidth,
    newBoardHeight,
    xOffset,
    yOffset,
    tileDimensions,
    startPoint
}: {
    currentBoard: HydratedGameBoard
    newBoardWidth: number
    newBoardHeight: number
    xOffset: number
    yOffset: number
    tileDimensions: Dimensions
    startPoint: Point
}): Cell[][] {
    const [boardWidth, boardHeight] = currentBoard.dimensions()
    const boardCorner = { x: 0, y: 0 }

    // Now merge in the new board tile
    const newCells: Cell[][] = []
    for (let y = 0; y < newBoardHeight; y++) {
        const newRow: Cell[] = []
        newCells.push(newRow)
        for (let x = 0; x < newBoardWidth; x++) {
            const offsetCoords = { x: x + xOffset, y: y + yOffset }

            if (
                // Favor the new one
                offsetCoords.x >= startPoint.x &&
                offsetCoords.x < startPoint.x + tileDimensions[0] &&
                offsetCoords.y >= startPoint.y &&
                offsetCoords.y < startPoint.y + tileDimensions[1]
            ) {
                newRow.push({ type: CellType.Empty })
            } else if (
                // Then the old one
                offsetCoords.x >= boardCorner.x &&
                offsetCoords.x < boardCorner.x + boardWidth &&
                offsetCoords.y >= boardCorner.y &&
                offsetCoords.y < boardCorner.y + boardHeight
            ) {
                const oldCell = currentBoard.getCell([offsetCoords.x, offsetCoords.y])
                if (oldCell) {
                    newRow.push(oldCell)
                }
            } else {
                // Then off board
                newRow.push({ type: CellType.OffBoard })
            }
        }
    }
    return newCells
}

function placeTrucks(board: HydratedGameBoard, random: RandomFunction) {
    const xMid = Math.floor(board.dimensions()[0] / 2)
    const yMid = Math.floor(board.dimensions()[1] / 2)

    const truckCells: TruckCell[] = [
        { type: CellType.Truck, goodsType: GoodsType.Cheese },
        { type: CellType.Truck, goodsType: GoodsType.Fish },
        { type: CellType.Truck, goodsType: GoodsType.IceCream },
        { type: CellType.Truck, goodsType: GoodsType.Lemonade }
    ]
    shuffle(truckCells, random)

    const { coords, direction } = board.getMostSquareExternalCorner()

    //NW
    if (direction === Direction.NorthWest) {
        board.setCell(coords, truckCells[0])
    } else {
        let cell: Cell | undefined
        let x = 0
        let y = 0
        while (cell?.type !== CellType.Empty) {
            x = Math.floor(random() * xMid)
            y = Math.floor(random() * yMid)
            cell = board.getCell([x, y])
        }
        board.setCell([x, y], truckCells[0])
    }

    //NE
    if (direction === Direction.NorthEast) {
        board.setCell(coords, truckCells[1])
    } else {
        let cell: Cell | undefined
        let x = 0
        let y = 0
        while (cell?.type !== CellType.Empty) {
            x = Math.floor(random() * xMid) + xMid
            y = Math.floor(random() * yMid)
            cell = board.getCell([x, y])
        }
        board.setCell([x, y], truckCells[1])
    }

    //SE
    if (direction === Direction.SouthEast) {
        board.setCell(coords, truckCells[2])
    } else {
        let cell: Cell | undefined
        let x = 0
        let y = 0
        while (cell?.type !== CellType.Empty) {
            x = Math.floor(random() * xMid) + xMid
            y = Math.floor(random() * yMid) + yMid
            cell = board.getCell([x, y])
        }
        board.setCell([x, y], truckCells[2])
    }

    //SW
    if (direction === Direction.SouthWest) {
        board.setCell(coords, truckCells[3])
    } else {
        let cell: Cell | undefined
        let x = 0
        let y = 0
        while (cell?.type !== CellType.Empty) {
            x = Math.floor(random() * xMid)
            y = Math.floor(random() * yMid) + yMid
            cell = board.getCell([x, y])
        }
        board.setCell([x, y], truckCells[3])
    }
}

function findLongestSide(board: HydratedGameBoard, random: RandomFunction): Direction {
    const directions = [Direction.North, Direction.East, Direction.South, Direction.West]
    shuffle(directions, random)

    const longestSide = directions
        .map((direction) => {
            return { direction, length: board.getContiguousSide(direction).length }
        })
        .reduce((acc, curr) => {
            return curr.length > acc.length ? curr : acc
        })
    return longestSide.direction
}

function getStartPointForEdge(
    board: HydratedGameBoard,
    edge: Direction,
    tileDimensions: Dimensions,
    allowNegative: boolean = true,
    random: RandomFunction
): Point {
    const side = board.getContiguousSide(edge)
    const newStartPoint = { x: 0, y: 0 }
    const neg = Math.round(random())
    switch (edge) {
        case Direction.North: {
            const offset = Math.floor(random() * (side.length - tileDimensions[0]))
            newStartPoint.y = -tileDimensions[1]
            newStartPoint.x = allowNegative && neg ? side.start[0] - offset : side.start[0] + offset
            break
        }
        case Direction.East: {
            const offset = Math.floor(random() * (side.length - tileDimensions[1]))
            newStartPoint.y = allowNegative && neg ? side.start[1] - offset : side.start[1] + offset
            newStartPoint.x = side.start[0] + 1
            break
        }
        case Direction.South: {
            const offset = Math.floor(random() * (side.length - tileDimensions[0]))
            newStartPoint.y = side.start[1] + 1
            newStartPoint.x = allowNegative && neg ? side.start[0] - offset : side.start[0] + offset
            break
        }
        case Direction.West: {
            const offset = Math.floor(random() * (side.length - tileDimensions[1]))
            newStartPoint.y = allowNegative && neg ? side.start[1] - offset : side.start[1] + offset
            newStartPoint.x = -tileDimensions[0]
            break
        }
    }

    return newStartPoint
}

function getStartPointForCorner(deepestCorner: InternalCorner, tileDimensions: Dimensions): Point {
    let startPoint: Point = { x: 0, y: 0 }

    switch (deepestCorner.direction) {
        case Direction.NorthWest: {
            startPoint = {
                x: deepestCorner.coords[0],
                y: deepestCorner.coords[1]
            }
            break
        }
        case Direction.NorthEast: {
            startPoint = {
                x: deepestCorner.coords[0] - (tileDimensions[0] - 1),
                y: deepestCorner.coords[1]
            }
            break
        }
        case Direction.SouthEast: {
            startPoint = {
                x: deepestCorner.coords[0] - (tileDimensions[0] - 1),
                y: deepestCorner.coords[1] - (tileDimensions[1] - 1)
            }

            break
        }
        case Direction.SouthWest: {
            startPoint = {
                x: deepestCorner.coords[0],
                y: deepestCorner.coords[1] - (tileDimensions[1] - 1)
            }
            break
        }
    }
    return startPoint
}

function getOffsetsAndDimensions(
    oldStartPoint: { x: number; y: number },
    newStartPoint: { x: number; y: number },
    boardDimensions: Dimensions,
    tileDimensions: Dimensions
): { xOffset: number; yOffset: number; width: number; height: number } {
    const xOffset = newStartPoint.x - oldStartPoint.x < 0 ? newStartPoint.x - oldStartPoint.x : 0
    const yOffset = newStartPoint.y - oldStartPoint.y < 0 ? newStartPoint.y - oldStartPoint.y : 0

    const width =
        Math.max(oldStartPoint.x + boardDimensions[0], newStartPoint.x + tileDimensions[0]) -
        xOffset
    const height =
        Math.max(oldStartPoint.y + boardDimensions[1], newStartPoint.y + tileDimensions[1]) -
        yOffset

    return { xOffset, yOffset, width, height }
}

function isValidMarketTotal(tiles: BoardTile[], numPlayers: number): boolean {
    const totalMarkets = tiles.reduce((acc, tile) => acc + tile.marketCount, 0)
    return numPlayers === 5 ? totalMarkets <= 18 : true
}

export function generateTestBoard(data: string[]): HydratedGameBoard {
    const cells: Cell[][] = data.map((row) => {
        const charCells = row.split('|')
        charCells.shift()
        charCells.pop()
        return charCells.map((cell) => {
            const trimmed = cell.trim()
            switch (true) {
                case trimmed.length === 1: {
                    switch (trimmed) {
                        case 'X': {
                            return { type: CellType.OffBoard }
                        }
                        case 'M': {
                            return { type: CellType.Market }
                        }
                        case '+': {
                            return { type: CellType.Road }
                        }
                        default: {
                            return { type: CellType.Empty }
                        }
                    }
                    break
                }
                case TruckRegex.test(trimmed): {
                    return { type: CellType.Truck, goodsType: letterToGoodsType(trimmed[1]) }
                }
                case PlayerDiskRegex.test(trimmed): {
                    return { type: CellType.Disk, playerId: letterToPlayerId(trimmed[1]) }
                }
                case PlayerStallRegex.test(trimmed): {
                    return {
                        type: CellType.Stall,
                        goodsType: letterToGoodsType(trimmed[1]),
                        playerId: letterToPlayerId(trimmed[2])
                    }
                }
                default: {
                    return { type: CellType.Empty }
                }
            }
        })
    })
    return new HydratedGameBoard({ cells: cells })
}

function letterToGoodsType(letter: string): GoodsType {
    switch (letter) {
        case 'F': {
            return GoodsType.Fish
        }
        case 'C': {
            return GoodsType.Cheese
        }
        case 'L': {
            return GoodsType.Lemonade
        }
        case 'I': {
            return GoodsType.IceCream
        }
        default: {
            return GoodsType.Fish
        }
    }
}

function letterToPlayerId(letter: string): string {
    return `p${letter}`
}
