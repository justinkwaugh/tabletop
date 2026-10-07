import type { Point } from '@tabletop/common'
import { ACTION_SPACES, hex, type ActionSpace } from '@tabletop/hill-country-grocers'

export const ACTION_BOARD_Y = 12
export const ACTION_BOX_WIDTH = 304
export const ACTION_BOX_HEIGHT = 174

export const HEX_RADIUS = 74
const HALF_HEIGHT = (HEX_RADIUS * Math.sqrt(3)) / 2
const MAP_TOP = ACTION_BOARD_Y + ACTION_BOX_HEIGHT + 14
const MAP_X = 24
const MAP_Y = MAP_TOP + 12

export const MAP_RECT = { x: 12, y: MAP_TOP, width: 950, height: 668 }

export function hexCenter(hexId: string): Point {
    const { col, row } = hex(hexId)
    return {
        x: MAP_X + HEX_RADIUS + col * 1.5 * HEX_RADIUS,
        y: MAP_Y + HALF_HEIGHT + row * HALF_HEIGHT
    }
}

export function hexPoints(center: Point, radius: number = HEX_RADIUS): string {
    return Array.from({ length: 6 }, (_, index) => {
        const angle = (Math.PI / 3) * index
        return `${center.x + radius * Math.cos(angle)},${center.y + radius * Math.sin(angle)}`
    }).join(' ')
}

export function actionBoxX(space: ActionSpace): number {
    return 12 + ACTION_SPACES.indexOf(space) * (ACTION_BOX_WIDTH + 19)
}

export const ROUND_TRACK_Y = MAP_RECT.y + MAP_RECT.height + 16
export const ROUND_SLOT_WIDTH = 74
export const ROUND_TRACK_X = 12

export const COMPANY_CARD_X = 980
export const COMPANY_CARD_Y = 12
export const COMPANY_CARD_WIDTH = 478
export const COMPANY_CARD_HEIGHT = 182
export const COMPANY_CARD_GAP = 8

export const BOARD_WIDTH = COMPANY_CARD_X + COMPANY_CARD_WIDTH + 12
export const BOARD_HEIGHT = ROUND_TRACK_Y + 110
