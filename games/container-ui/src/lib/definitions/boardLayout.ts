const BASE_BOARD_WIDTH = 1600
const BASE_BOARD_HEIGHT = 1280
const BOARD_CORNER_RADIUS = 36

export const PLAYER_BOARD_WIDTH = 328
export const PLAYER_BOARD_HEIGHT = 551
const PLAYER_BOARD_MARGIN_X = 18
const PLAYER_BOARD_MARGIN_Y = 18
const PLAYER_BOARD_GAP_Y = 34

export const ISLAND_IMAGE_WIDTH = 719
export const ISLAND_IMAGE_HEIGHT = 855

export type PlayerBoardOrientation = 'left' | 'right'

export type PlayerBoardSeat = {
    playerId: string
    orientation: PlayerBoardOrientation
    x: number
    y: number
    width: number
    height: number
}

export type BoardRect = {
    x: number
    y: number
    width: number
    height: number
}

export type BoardLayout = {
    boardWidth: number
    boardHeight: number
    boardCornerRadius: number
    islandRect: BoardRect
    playerBoardSeats: PlayerBoardSeat[]
}

function computeBoardHeight(playerCount: number): number {
    if (playerCount <= 4) {
        return BASE_BOARD_HEIGHT
    }

    const maxColumnCount = Math.ceil(playerCount / 2)
    const stackedHeight =
        maxColumnCount * PLAYER_BOARD_HEIGHT +
        Math.max(0, maxColumnCount - 1) * PLAYER_BOARD_GAP_Y +
        PLAYER_BOARD_MARGIN_Y * 2

    return Math.max(BASE_BOARD_HEIGHT, stackedHeight)
}

function topY(): number {
    return PLAYER_BOARD_MARGIN_Y
}

function centeredStackYPositions(count: number, boardHeight: number): number[] {
    if (count <= 0) {
        return []
    }

    const totalHeight = count * PLAYER_BOARD_HEIGHT + (count - 1) * PLAYER_BOARD_GAP_Y
    const startY = (boardHeight - totalHeight) / 2

    return Array.from(
        { length: count },
        (_, index) => startY + index * (PLAYER_BOARD_HEIGHT + PLAYER_BOARD_GAP_Y)
    )
}

function middleY(boardHeight: number): number {
    return (boardHeight - PLAYER_BOARD_HEIGHT) / 2
}

function bottomY(boardHeight: number): number {
    return boardHeight - PLAYER_BOARD_MARGIN_Y - PLAYER_BOARD_HEIGHT
}

function leftX(): number {
    return PLAYER_BOARD_MARGIN_X
}

function rightX(boardWidth: number): number {
    return boardWidth - PLAYER_BOARD_MARGIN_X - PLAYER_BOARD_WIDTH
}

export function buildBoardLayout(playerIds: string[]): BoardLayout {
    const boardWidth = BASE_BOARD_WIDTH
    const boardHeight = computeBoardHeight(playerIds.length)
    const islandRect = {
        x: (boardWidth - ISLAND_IMAGE_WIDTH) / 2,
        y: (boardHeight - ISLAND_IMAGE_HEIGHT) / 2,
        width: ISLAND_IMAGE_WIDTH,
        height: ISLAND_IMAGE_HEIGHT
    }

    const lx = leftX()
    const rx = rightX(boardWidth)
    const top = topY()
    const middle = middleY(boardHeight)
    const bottom = bottomY(boardHeight)
    const centeredRightYs = centeredStackYPositions(2, boardHeight)

    const seatTemplatesByPlayerCount: Record<
        number,
        Array<{ orientation: PlayerBoardOrientation; x: number; y: number }>
    > = {
        3: [
            { orientation: 'left', x: lx, y: top },
            { orientation: 'right', x: rx, y: middle },
            { orientation: 'left', x: lx, y: bottom }
        ],
        4: [
            { orientation: 'left', x: lx, y: top },
            { orientation: 'right', x: rx, y: top },
            { orientation: 'right', x: rx, y: bottom },
            { orientation: 'left', x: lx, y: bottom }
        ],
        5: [
            { orientation: 'left', x: lx, y: top },
            { orientation: 'right', x: rx, y: centeredRightYs[0] ?? top },
            { orientation: 'right', x: rx, y: centeredRightYs[1] ?? bottom },
            { orientation: 'left', x: lx, y: bottom },
            { orientation: 'left', x: lx, y: middle }
        ]
    }

    const seatTemplates = seatTemplatesByPlayerCount[playerIds.length]
    if (!seatTemplates) {
        throw new Error(`Unsupported Container player count: ${playerIds.length}`)
    }

    const playerBoardSeats = playerIds.map((playerId, index) => {
        const seat = seatTemplates[index]
        if (!seat) {
            throw new Error(`Missing Container player board seat for index ${index}`)
        }

        return {
            playerId,
            orientation: seat.orientation,
            x: seat.x,
            y: seat.y,
            width: PLAYER_BOARD_WIDTH,
            height: PLAYER_BOARD_HEIGHT
        }
    })

    return {
        boardWidth,
        boardHeight,
        boardCornerRadius: BOARD_CORNER_RADIUS,
        islandRect,
        playerBoardSeats
    }
}
