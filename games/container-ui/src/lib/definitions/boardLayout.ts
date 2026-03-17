export const BOARD_WIDTH = 1600
export const BOARD_HEIGHT = 1280

export const PLAYER_BOARD_WIDTH = 328
export const PLAYER_BOARD_HEIGHT = 551
const PLAYER_BOARD_MARGIN_X = 18
const PLAYER_BOARD_GAP_Y = 34

export const ISLAND_IMAGE_WIDTH = 719
export const ISLAND_IMAGE_HEIGHT = 855
export const ISLAND_IMAGE_X = (BOARD_WIDTH - ISLAND_IMAGE_WIDTH) / 2
export const ISLAND_IMAGE_Y = (BOARD_HEIGHT - ISLAND_IMAGE_HEIGHT) / 2

export type PlayerBoardOrientation = 'left' | 'right'

export type PlayerBoardSeat = {
    playerId: string
    orientation: PlayerBoardOrientation
    x: number
    y: number
    width: number
    height: number
}

function centeredStackYPositions(count: number): number[] {
    if (count <= 0) {
        return []
    }

    const totalHeight = count * PLAYER_BOARD_HEIGHT + (count - 1) * PLAYER_BOARD_GAP_Y
    const startY = (BOARD_HEIGHT - totalHeight) / 2

    return Array.from({ length: count }, (_, index) => startY + index * (PLAYER_BOARD_HEIGHT + PLAYER_BOARD_GAP_Y))
}

export function buildPlayerBoardSeats(playerIds: string[]): PlayerBoardSeat[] {
    const leftPlayerIds = playerIds.filter((_, index) => index % 2 === 0)
    const rightPlayerIds = playerIds.filter((_, index) => index % 2 === 1)

    const leftYs = centeredStackYPositions(leftPlayerIds.length)
    const rightYs = centeredStackYPositions(rightPlayerIds.length)
    const leftX = PLAYER_BOARD_MARGIN_X
    const rightX = BOARD_WIDTH - PLAYER_BOARD_MARGIN_X - PLAYER_BOARD_WIDTH

    let leftIndex = 0
    let rightIndex = 0

    return playerIds.map((playerId, index) => {
        if (index % 2 === 0) {
            const y = leftYs[leftIndex] ?? 0
            leftIndex += 1
            return {
                playerId,
                orientation: 'left',
                x: leftX,
                y,
                width: PLAYER_BOARD_WIDTH,
                height: PLAYER_BOARD_HEIGHT
            }
        }

        const y = rightYs[rightIndex] ?? 0
        rightIndex += 1
        return {
            playerId,
            orientation: 'right',
            x: rightX,
            y,
            width: PLAYER_BOARD_WIDTH,
            height: PLAYER_BOARD_HEIGHT
        }
    })
}
