import type { MapArt } from '$lib/maps/mapArt.js'

export const BOARD_GAP = 20
export const MARKET_COLUMN = 660
const MAP_BORDER = 6
const PLANT_MARKET_HEIGHT = 340
const RESOURCE_MARKET_HEIGHT = 350

export type BoardArea = 'map' | 'plants' | 'resources'
export type BoardRect = { x: number; y: number; width: number; height: number }

export function stackedAreaRect(art: MapArt, area: BoardArea): BoardRect {
    const mapHeight = art.height + MAP_BORDER
    const plantsTop = mapHeight + BOARD_GAP
    switch (area) {
        case 'map':
            return { x: 0, y: 0, width: art.width, height: mapHeight }
        case 'plants':
            return { x: 0, y: plantsTop, width: art.width, height: PLANT_MARKET_HEIGHT }
        case 'resources':
            return {
                x: 0,
                y: plantsTop + PLANT_MARKET_HEIGHT + BOARD_GAP,
                width: art.width,
                height: RESOURCE_MARKET_HEIGHT
            }
    }
}
