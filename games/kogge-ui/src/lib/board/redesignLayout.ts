import type { Point } from '@tabletop/common'
import type { BoardGeometry } from './geometry.js'
import type { Rect } from './layout.js'

// Positions on rvtk's redesigned board, measured on its picture scaled to 1600 wide. Every
// city panel is the same upright panel turned to face the sea.
export const REDESIGN_WIDTH = 1600
export const REDESIGN_HEIGHT = 1131

export interface RedesignPanel {
    centre: Point
    rotation: 0 | 90 | 180 | 270
    routeSquares: [Point, Point]
}

export const ROUTE_SQUARE_SIZE = 66

const PANELS: readonly RedesignPanel[] = [
    {
        centre: { x: 249, y: 161 },
        rotation: 180,
        routeSquares: [
            { x: 302, y: 303 },
            { x: 383, y: 303 }
        ]
    },
    {
        centre: { x: 583.5, y: 161 },
        rotation: 180,
        routeSquares: [
            { x: 539, y: 303 },
            { x: 620, y: 303 }
        ]
    },
    {
        centre: { x: 914, y: 161 },
        rotation: 180,
        routeSquares: [
            { x: 780, y: 303 },
            { x: 861, y: 303 }
        ]
    },
    {
        centre: { x: 1002, y: 457 },
        rotation: 270,
        routeSquares: [
            { x: 862, y: 458 },
            { x: 862, y: 540 }
        ]
    },
    {
        centre: { x: 1002, y: 785 },
        rotation: 270,
        routeSquares: [
            { x: 862, y: 703 },
            { x: 862, y: 785 }
        ]
    },
    {
        centre: { x: 744, y: 961 },
        rotation: 0,
        routeSquares: [
            { x: 661, y: 823 },
            { x: 742, y: 823 }
        ]
    },
    {
        centre: { x: 421, y: 961 },
        rotation: 0,
        routeSquares: [
            { x: 421, y: 823 },
            { x: 503, y: 823 }
        ]
    },
    {
        centre: { x: 161, y: 785 },
        rotation: 90,
        routeSquares: [
            { x: 303, y: 703 },
            { x: 303, y: 785 }
        ]
    },
    {
        centre: { x: 161, y: 453 },
        rotation: 90,
        routeSquares: [
            { x: 303, y: 458 },
            { x: 303, y: 540 }
        ]
    }
]

// The upright panel (302 x 174), as offsets from its centre.
export const PANEL_WIDTH = 302
export const PANEL_HEIGHT = 174
export const PANEL_SPOTS = {
    offices: [
        { x: -116, y: -29.5, width: 52, height: 103 },
        { x: 117, y: -29.5, width: 54, height: 103 }
    ],
    goods: { x: 0.5, y: -29.5, width: 163, height: 103 },
    guildMaster: { x: 117.5, y: 55.5, width: 53, height: 53 }
} as const

const HARBOUR_DISTANCE = 72

export function redesignPanel(city: number): RedesignPanel {
    const panel = PANELS[city]
    if (!panel) {
        throw Error(`No redesign panel for city ${city}`)
    }
    return panel
}

export function rotateOffset(offset: Point, rotation: RedesignPanel['rotation']): Point {
    switch (rotation) {
        case 0:
            return offset
        case 90:
            return { x: -offset.y, y: offset.x }
        case 180:
            return { x: -offset.x, y: -offset.y }
        case 270:
            return { x: offset.y, y: -offset.x }
    }
}

export function panelSpot(city: number, spot: { x: number; y: number }): Point {
    const panel = redesignPanel(city)
    const offset = rotateOffset(spot, panel.rotation)
    return { x: panel.centre.x + offset.x, y: panel.centre.y + offset.y }
}

function seaward(panel: RedesignPanel): Point {
    return rotateOffset({ x: 0, y: -1 }, panel.rotation)
}

export const REDESIGN_GEOMETRY: BoardGeometry = {
    width: REDESIGN_WIDTH,
    height: REDESIGN_HEIGHT,
    seaCentre: { x: 585, y: 560 },
    harbour: (city) => {
        const panel = redesignPanel(city)
        const [a, b] = panel.routeSquares
        const direction = seaward(panel)
        return {
            x: (a.x + b.x) / 2 + direction.x * HARBOUR_DISTANCE,
            y: (a.y + b.y) / 2 + direction.y * HARBOUR_DISTANCE
        }
    },
    guildMasterSpot: (city) => {
        const spot = panelSpot(city, PANEL_SPOTS.guildMaster)
        return { x: spot.x, y: spot.y + 22 }
    }
}

export const MARKET_BOXES: readonly Rect[] = [225, 348, 468, 588].map((y) => ({
    x: 1510,
    y,
    width: 80,
    height: 105
}))

export const TURN_ORDER_SPOTS: readonly Point[] = [1300, 1352, 1405, 1457].map((x) => ({
    x,
    y: 290
}))

export const DEVELOPMENT_TRACK: readonly Point[] = [1227, 1280, 1332, 1384, 1436].map((x) => ({
    x,
    y: 200
}))

export const BONUS_SPOTS: readonly Rect[] = [
    { x: 1260, y: 900, width: 105, height: 78 },
    { x: 1375, y: 900, width: 105, height: 78 },
    { x: 1260, y: 988, width: 105, height: 78 },
    { x: 1375, y: 988, width: 105, height: 78 }
]

export const REDESIGN_WAREHOUSE: Rect = { x: 22, y: 948, width: 236, height: 160 }
export const REDESIGN_LAP_TRACK: Rect = { x: 905, y: 1045, width: 200, height: 70 }
