import { assertExists, type Point } from '@tabletop/common'
import type { BoardTile, TileFace, TileRotation } from '@tabletop/18xx'
import { placedTileLayout } from '../tiles/standardTileLayouts.js'
import type { TileLayout } from '../tiles/tileDrawing.js'
import { drawnLocation, type HexSegment, type MapDrawing } from './mapDrawing.js'
import type { MapViewDefinition } from './stationPresentation.js'

/** The span a tile drawing takes, in map units, around its hex's centre. */
export const TileBox = 106

/** Where a piece's hexes stand: each from the piece's middle, and the box the piece fills, in map units. */
export type PieceLayout = {
    middle: Point
    offsets: readonly Point[]
    width: number
    height: number
}

/** Lays out the hexes of a tile piece from their centres on the map. */
export function pieceLayout(centers: readonly Point[]): PieceLayout {
    const xs = centers.map((center) => center.x)
    const ys = centers.map((center) => center.y)
    const middle = {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2
    }
    return {
        middle,
        offsets: centers.map((center) => ({ x: center.x - middle.x, y: center.y - middle.y })),
        width: Math.max(...xs) - Math.min(...xs) + TileBox,
        height: Math.max(...ys) - Math.min(...ys) + TileBox
    }
}

/** One hex of a piece as drawn: its tile, where it stands from the piece's middle, and its sides. */
export type PieceHex = {
    face: TileFace
    printedNumber: string
    rotation: TileRotation
    layout?: TileLayout
    /** From the piece's middle, in map units. */
    offset: Point
    /** Its sides on the piece's edge, which the piece outlines. */
    outline: readonly HexSegment[]
    /** Its sides shared with another hex of the piece, drawn without a seam. */
    joints: readonly HexSegment[]
}

type PieceView = Pick<MapViewDefinition, 'layouts'> & {
    tileSet: Pick<MapViewDefinition['tileSet'], 'definitions'>
}

/** Draws the tiles one lay places together as one piece, from where their hexes stand on the map. */
export function pieceDrawing(
    tiles: readonly BoardTile[],
    scene: Pick<MapDrawing, 'locations'>,
    view: PieceView
): { hexes: PieceHex[]; layout: PieceLayout } {
    const hexes = tiles.map((tile) => {
        return { tile, entry: drawnLocation(scene, tile.locationId) }
    })
    const layout = pieceLayout(hexes.map(({ entry }) => entry.center))
    return {
        layout,
        hexes: hexes.map(({ tile, entry }, index) => {
            const definition = view.tileSet.definitions.find(
                (candidate) => candidate.id === tile.definitionId
            )
            assertExists(definition, `Tile ${tile.definitionId} is in the set`)
            return {
                face: definition.face,
                printedNumber: definition.printedNumber,
                rotation: tile.rotation,
                layout: placedTileLayout(view.layouts, tile.definitionId),
                offset: layout.offsets[index],
                outline: entry.outline,
                joints: entry.joints
            }
        })
    }
}
