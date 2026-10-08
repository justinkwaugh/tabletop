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
export const ACTION_BOX_HEIGHT = 80

export const HEX_RADIUS = 74
const HEX_DIMENSIONS = circleDimensionsToElliptical({ radius: HEX_RADIUS }, HexOrientation.Flat)
const HEADER_TOP = ACTION_BOARD_Y + ACTION_BOX_HEIGHT + 14
const HEADER_HEIGHT = 80
const MAP_TOP = HEADER_TOP + HEADER_HEIGHT
const WEST_COLUMN_CENTER: Point = { x: 24 + HEX_RADIUS, y: MAP_TOP + 12 + HEX_DIMENSIONS.yRadius }

export const MAP_RECT = { x: 12, y: MAP_TOP, width: 950, height: 740 }

export const ROUND_HEADER_RECT = {
    x: MAP_RECT.x,
    y: HEADER_TOP,
    width: MAP_RECT.width,
    height: HEADER_HEIGHT
}

// The round header and the map share one sheet of paper.
export const SHEET_RECT = {
    x: MAP_RECT.x,
    y: HEADER_TOP,
    width: MAP_RECT.width,
    height: HEADER_HEIGHT + MAP_RECT.height
}

export const SHEET_CORNER = 14

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

export const LEGEND_RECT = {
    x: MAP_RECT.x + MAP_RECT.width - 206,
    y: MAP_RECT.y + MAP_RECT.height - 124,
    width: 198,
    height: 116
}

export const ROUND_SLOT_WIDTH = 54
export const ROUND_SLOT_HEIGHT = 44

export const BOARD_WIDTH = MAP_RECT.x + MAP_RECT.width + 12

// Room under the map for the scaling wrapper's bottom-left zoom controls.
export const BOARD_HEIGHT = MAP_RECT.y + MAP_RECT.height + 56
