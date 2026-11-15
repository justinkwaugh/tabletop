import type { AxialCoordinates, BoundingBox, Point } from '@tabletop/common'
import { mapSpace, type MapSpace } from '@tabletop/preussische-ostbahn'

export const HEX_SIZE = 40
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE
const MARGIN = 10

export const BOARD_WIDTH = 1530
export const MAP_HEIGHT = 1200
export const INCOME_AREA = { x: 10, y: MAP_HEIGHT + 4, width: 1510, height: 74 }
export const BOARD_HEIGHT = INCOME_AREA.y + INCOME_AREA.height + 6
export const BOARD_PADDING = 24

export function hexCenter(coords: AxialCoordinates): Point {
    const col = 2 * coords.q + coords.r
    return {
        x: (HEX_WIDTH * (col - 2)) / 2 + MARGIN,
        y: 1.5 * HEX_SIZE * coords.r + HEX_SIZE + MARGIN
    }
}

export function hexCorners(center: Point, size: number = HEX_SIZE): Point[] {
    return [0, 1, 2, 3, 4, 5].map((index) => {
        const angle = (Math.PI / 180) * (60 * index - 30)
        return { x: center.x + size * Math.cos(angle), y: center.y + size * Math.sin(angle) }
    })
}

export function hexPoints(center: Point, size: number = HEX_SIZE): string {
    return hexCorners(center, size)
        .map((corner) => `${corner.x.toFixed(1)},${corner.y.toFixed(1)}`)
        .join(' ')
}

export function spaceCenter(space: MapSpace): Point {
    const centers = space.hexes.map(hexCenter)
    return {
        x: centers.reduce((sum, point) => sum + point.x, 0) / centers.length,
        y: centers.reduce((sum, point) => sum + point.y, 0) / centers.length
    }
}

export function spaceCenterById(spaceId: string): Point {
    return spaceCenter(mapSpace(spaceId))
}

const LEGEND_WIDTH = 252
const LEGEND_TOP = 384
const LEGEND_HEIGHT = 350
const CARDS_HEIGHT = 366
const CARDS_RIGHT = 1520
const CARDS_GAP = (INCOME_AREA.y - (LEGEND_TOP + LEGEND_HEIGHT) - CARDS_HEIGHT) / 2

export const CARD_AREA = {
    x: CARDS_RIGHT - 700,
    y: LEGEND_TOP + LEGEND_HEIGHT + CARDS_GAP,
    width: 700,
    height: CARDS_HEIGHT
}
export const LEGEND_AREA = {
    x: CARDS_RIGHT - LEGEND_WIDTH,
    y: LEGEND_TOP,
    width: LEGEND_WIDTH,
    height: LEGEND_HEIGHT
}
export const TURN_ORDER_AREA = { x: 18, y: 104, width: 240, height: 72 }

export enum BoardFocus {
    Map = 'Map',
    Railroads = 'Railroads'
}

export const RAILROADS_FOCUS_RECT: BoundingBox = {
    ...CARD_AREA,
    x: CARD_AREA.x + BOARD_PADDING,
    y: CARD_AREA.y + BOARD_PADDING
}
