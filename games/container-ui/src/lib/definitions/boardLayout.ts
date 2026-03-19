const BASE_BOARD_WIDTH = 1700
const BASE_BOARD_HEIGHT = 1280
const BOARD_CORNER_RADIUS = 36
const ISLAND_SOURCE_WIDTH = 1049
const OFFSHORE_SOURCE_WIDTH = 1914
const OFFSHORE_SOURCE_HEIGHT = 2303
const ISLAND_RENDER_SCALE = 719 / ISLAND_SOURCE_WIDTH
const OFFSHORE_IMAGE_WIDTH = (OFFSHORE_SOURCE_WIDTH / 2) * ISLAND_RENDER_SCALE
const OFFSHORE_IMAGE_HEIGHT = OFFSHORE_IMAGE_WIDTH * (OFFSHORE_SOURCE_HEIGHT / OFFSHORE_SOURCE_WIDTH)
const ISLAND_STACK_MIN_SPACING = 48
const OFFSHORE_FOUR_PLAYER_COLUMN_OFFSET_Y = 200
const FIVE_PLAYER_NO_OFFSHORE_RIGHT_STACK_OFFSET_Y = 48

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
    offshoreRect?: BoardRect
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

function computeIslandStackBoardHeight(hasOffshore: boolean): number {
    if (!hasOffshore) {
        return BASE_BOARD_HEIGHT
    }

    return Math.ceil(
        ISLAND_IMAGE_HEIGHT + OFFSHORE_IMAGE_HEIGHT + ISLAND_STACK_MIN_SPACING * 3
    )
}

export function buildBoardLayout(
    playerIds: string[],
    { hasOffshore = false }: { hasOffshore?: boolean } = {}
): BoardLayout {
    const boardWidth = BASE_BOARD_WIDTH
    const boardHeight = Math.max(
        computeBoardHeight(playerIds.length),
        computeIslandStackBoardHeight(hasOffshore)
    )
    const islandX = (boardWidth - ISLAND_IMAGE_WIDTH) / 2
    const offshoreX = (boardWidth - OFFSHORE_IMAGE_WIDTH) / 2
    const stackSpacing = hasOffshore
        ? (boardHeight - OFFSHORE_IMAGE_HEIGHT - ISLAND_IMAGE_HEIGHT) / 3
        : 0
    const islandRect = hasOffshore
        ? {
              x: islandX,
              y: stackSpacing,
              width: ISLAND_IMAGE_WIDTH,
              height: ISLAND_IMAGE_HEIGHT
          }
        : {
              x: islandX,
              y: (boardHeight - ISLAND_IMAGE_HEIGHT) / 2,
              width: ISLAND_IMAGE_WIDTH,
              height: ISLAND_IMAGE_HEIGHT
          }
    const offshoreRect = hasOffshore
        ? {
              x: offshoreX,
              y: stackSpacing * 2 + ISLAND_IMAGE_HEIGHT,
              width: OFFSHORE_IMAGE_WIDTH,
              height: OFFSHORE_IMAGE_HEIGHT
          }
        : undefined

    const lx = leftX()
    const rx = rightX(boardWidth)
    const top = topY()
    const middle = middleY(boardHeight)
    const bottom = bottomY(boardHeight)
    const centeredLeftYs = centeredStackYPositions(
        playerIds.length === 5 ? 3 : 2,
        boardHeight
    )
    const centeredRightYs = centeredStackYPositions(2, boardHeight)

    const seatTemplatesByPlayerCount: Record<
        number,
        Array<{ orientation: PlayerBoardOrientation; x: number; y: number }>
    > = {
        3: hasOffshore
            ? [
                  {
                      orientation: 'left',
                      x: lx,
                      y: (centeredLeftYs[0] ?? top) - OFFSHORE_FOUR_PLAYER_COLUMN_OFFSET_Y
                  },
                  { orientation: 'right', x: rx, y: middle },
                  {
                      orientation: 'left',
                      x: lx,
                      y: (centeredLeftYs[1] ?? bottom) - OFFSHORE_FOUR_PLAYER_COLUMN_OFFSET_Y
                  }
              ]
            : [
                  { orientation: 'left', x: lx, y: top },
                  { orientation: 'right', x: rx, y: top },
                  { orientation: 'left', x: lx, y: bottom }
              ],
        4: hasOffshore
            ? [
                  {
                      orientation: 'left',
                      x: lx,
                      y: (centeredLeftYs[0] ?? top) - OFFSHORE_FOUR_PLAYER_COLUMN_OFFSET_Y
                  },
                  {
                      orientation: 'right',
                      x: rx,
                      y: (centeredRightYs[0] ?? top) + OFFSHORE_FOUR_PLAYER_COLUMN_OFFSET_Y
                  },
                  {
                      orientation: 'right',
                      x: rx,
                      y: (centeredRightYs[1] ?? bottom) + OFFSHORE_FOUR_PLAYER_COLUMN_OFFSET_Y
                  },
                  {
                      orientation: 'left',
                      x: lx,
                      y: (centeredLeftYs[1] ?? bottom) - OFFSHORE_FOUR_PLAYER_COLUMN_OFFSET_Y
                  }
              ]
            : [
                  { orientation: 'left', x: lx, y: top },
                  { orientation: 'right', x: rx, y: top },
                  { orientation: 'right', x: rx, y: bottom },
                  { orientation: 'left', x: lx, y: bottom }
              ],
        5: [
            { orientation: 'left', x: lx, y: hasOffshore ? centeredLeftYs[0] ?? top : top },
            {
                orientation: 'right',
                x: rx,
                y: hasOffshore
                    ? bottom - PLAYER_BOARD_HEIGHT - PLAYER_BOARD_GAP_Y
                    : (centeredRightYs[0] ?? top) - FIVE_PLAYER_NO_OFFSHORE_RIGHT_STACK_OFFSET_Y
            },
            {
                orientation: 'right',
                x: rx,
                y: hasOffshore
                    ? bottom
                    : (centeredRightYs[1] ?? bottom) + FIVE_PLAYER_NO_OFFSHORE_RIGHT_STACK_OFFSET_Y
            },
            { orientation: 'left', x: lx, y: hasOffshore ? centeredLeftYs[2] ?? bottom : bottom },
            { orientation: 'left', x: lx, y: hasOffshore ? centeredLeftYs[1] ?? middle : middle }
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
        offshoreRect,
        playerBoardSeats
    }
}
