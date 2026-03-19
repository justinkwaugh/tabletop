import type { PlayerBoardOrientation } from '$lib/definitions/boardLayout.js'

export const PLAYER_BOARD_SOURCE_WIDTH = 448
export const PLAYER_BOARD_SOURCE_HEIGHT = 755

export const PLAYER_BOARD_DOCK_BOAT_TIP_SOURCE_X = 390
export const PLAYER_BOARD_DOCK_BOAT_CENTER_SOURCE_YS = [191, 315, 439, 563] as const

export type PlayerBoardDockBoatAnchor = {
    tipX: number
    centerY: number
    rotation: number
}

export function getPlayerBoardDockBoatAnchors(
    orientation: PlayerBoardOrientation,
    width: number,
    height: number
): PlayerBoardDockBoatAnchor[] {
    const leftTipX = width * (PLAYER_BOARD_DOCK_BOAT_TIP_SOURCE_X / PLAYER_BOARD_SOURCE_WIDTH)
    const tipX = orientation === 'right' ? width - leftTipX : leftTipX

    return PLAYER_BOARD_DOCK_BOAT_CENTER_SOURCE_YS.map((sourceCenterY) => ({
        tipX,
        centerY: height * (sourceCenterY / PLAYER_BOARD_SOURCE_HEIGHT),
        rotation: orientation === 'right' ? 180 : 0
    }))
}
