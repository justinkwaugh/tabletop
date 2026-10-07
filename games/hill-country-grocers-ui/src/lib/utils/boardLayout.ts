import {
    HexOrientation,
    calculateHexGeometry,
    circleDimensionsToElliptical,
    hexCoordsToCenterPoint,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { ACTION_SPACES, type ActionSpace } from '@tabletop/hill-country-grocers'

export const ACTION_BOARD_Y = 12
export const ACTION_BOX_WIDTH = 304
export const ACTION_BOX_HEIGHT = 174

export const HEX_RADIUS = 74
const HEX_DIMENSIONS = circleDimensionsToElliptical({ radius: HEX_RADIUS }, HexOrientation.Flat)
const MAP_TOP = ACTION_BOARD_Y + ACTION_BOX_HEIGHT + 14
const WEST_COLUMN_CENTER: Point = { x: 24 + HEX_RADIUS, y: MAP_TOP + 12 + HEX_DIMENSIONS.yRadius }

export const MAP_RECT = { x: 12, y: MAP_TOP, width: 950, height: 668 }

export function hexCenter(coords: AxialCoordinates): Point {
    const point = hexCoordsToCenterPoint(coords, HEX_DIMENSIONS, HexOrientation.Flat)
    return { x: point.x + WEST_COLUMN_CENTER.x, y: point.y + WEST_COLUMN_CENTER.y }
}

export function hexPoints(center: Point, radius: number = HEX_RADIUS): string {
    return calculateHexGeometry(
        { orientation: HexOrientation.Flat, dimensions: { radius } },
        { q: 0, r: 0 }
    )
        .vertices.map((vertex) => `${center.x + vertex.x},${center.y + vertex.y}`)
        .join(' ')
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
