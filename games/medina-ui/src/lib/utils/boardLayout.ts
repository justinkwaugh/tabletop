import type { Point, RectangleDimensions } from '@tabletop/common'
import { Tower } from '@tabletop/medina'

export type TileLayout = {
    palaceTiles: Point[]
    palaceTileSize: number
    tea: Point
    teaSize: number
    towers: Record<Tower, Point>
    towerTileSize: number
}

const PALACE_TILE_SIZE = 1.9
const PALACE_TILE_SPACING = 2.2
const ROW_ABOVE_CITY = 1.85
const TEA_LEFT_OF_ROW = 6.2
const TOWER_TILE_SIZE = 1.7
const TOWER_TILE_BESIDE_CITY = 1.65
const TOWER_TILE_IN_FROM_CORNER = 1.3

const TOWER_CORNERS: Record<Tower, Point> = {
    [Tower.NorthWest]: { x: -1, y: 1 },
    [Tower.NorthEast]: { x: 1, y: 1 },
    [Tower.SouthWest]: { x: -1, y: -1 },
    [Tower.SouthEast]: { x: 1, y: -1 }
}

function besideCity(size: RectangleDimensions): TileLayout {
    const rowY = size.height / 2 + ROW_ABOVE_CITY
    const towerAt = (tower: Tower): Point => ({
        x: TOWER_CORNERS[tower].x * (size.width / 2 + TOWER_TILE_BESIDE_CITY),
        y: TOWER_CORNERS[tower].y * (size.height / 2 - TOWER_TILE_IN_FROM_CORNER)
    })
    return {
        palaceTiles: [-1.5, -0.5, 0.5, 1.5].map((slot) => ({
            x: slot * PALACE_TILE_SPACING,
            y: rowY
        })),
        palaceTileSize: PALACE_TILE_SIZE,
        tea: { x: -TEA_LEFT_OF_ROW, y: rowY },
        teaSize: PALACE_TILE_SIZE,
        towers: {
            [Tower.NorthWest]: towerAt(Tower.NorthWest),
            [Tower.NorthEast]: towerAt(Tower.NorthEast),
            [Tower.SouthWest]: towerAt(Tower.SouthWest),
            [Tower.SouthEast]: towerAt(Tower.SouthEast)
        },
        towerTileSize: TOWER_TILE_SIZE
    }
}

const SIDEWAYS_SLOTS = 7
const SIDEWAYS_SLOT_FILL = 0.94
const SIDEWAYS_TOP_ROW = 1.54
const SIDEWAYS_BOTTOM_ROW = 1.45

// On the rotated board the city's long side runs up the screen: a row above it holds the palace
// tiles and tea between the two towers now at the top, and the other two towers sit below.
function sidewaysLayout(size: RectangleDimensions): TileLayout {
    const slot = size.height / SIDEWAYS_SLOTS
    const tileSize = slot * SIDEWAYS_SLOT_FILL
    const top = size.width / 2 + SIDEWAYS_TOP_ROW
    const bottom = -size.width / 2 - SIDEWAYS_BOTTOM_ROW
    const inSlot = (index: number, y: number): Point => ({ x: (index - 3) * slot, y })
    return {
        palaceTiles: [2, 3, 4, 5].map((index) => inSlot(index, top)),
        palaceTileSize: tileSize,
        tea: inSlot(1, top),
        teaSize: tileSize,
        towers: {
            [Tower.NorthEast]: inSlot(0, top),
            [Tower.SouthEast]: inSlot(6, top),
            [Tower.NorthWest]: inSlot(0, bottom),
            [Tower.SouthWest]: inSlot(6, bottom)
        },
        towerTileSize: tileSize
    }
}

export function tileLayout(size: RectangleDimensions, sideways: boolean): TileLayout {
    if (sideways) {
        return sidewaysLayout(size)
    }
    return besideCity(size)
}
