import type { BoundingBox, Point } from '@tabletop/common'
import {
    faceUp,
    type AlgaColor,
    type CoralColor,
    type CoralTileFace,
    type HydratedReefEncounterGameState,
    type ReefBoardId
} from '@tabletop/reef-encounter'
import { CoralTileFaceUrls } from '$lib/images/art.generated.js'
import {
    AlgaSpace,
    boardSquare,
    coralTileSlot,
    eatenShrimpSlot,
    larvaSpaceCube,
    larvaSpacePolyp
} from './artGeometry.js'
import { polypFaceUrl } from './polypFaces.js'

// Where a piece lies: on one reef board, or on the open sea. Positions are in that drawing's
// image pixels.
export type PieceContainer = ReefBoardId | 'sea'

type PieceBase = {
    // Stable for as long as the piece stays put; a piece that moves or changes gets a new key.
    key: string
    container: PieceContainer
    center: Point
    // Where it lies, for screen readers: "on board 2, row 3, column 4".
    place: string
}

export type PolypPiece = PieceBase & {
    kind: 'polyp'
    color: CoralColor
    box: BoundingBox
    url: string
    // The open-sea larva space a polyp waits in, outlined so overlapping polyps stay apart.
    larvaSpace?: CoralColor
}
export type ShrimpPiece = PieceBase & { kind: 'shrimp'; playerId: string; upsideDown: boolean }
// A coral tile on the open sea: it never moves, but turns over when a cylinder flips it.
export type CoralTilePiece = PieceBase & {
    kind: 'coralTile'
    tileId: number
    face: CoralTileFace
    starfishSideUp: boolean
    box: BoundingBox
    url: string
}
export type CubePiece = PieceBase & { kind: 'cube'; color: CoralColor }
export type CylinderPiece = PieceBase & { kind: 'cylinder'; color: AlgaColor; size: number }

export type TablePiece = PolypPiece | ShrimpPiece | CubePiece | CylinderPiece | CoralTilePiece

// Drawn in this order, so shrimps lie on polyps and cylinders stand on coral tiles.
const Layer: Record<TablePiece['kind'], number> = {
    coralTile: 0,
    polyp: 0,
    cube: 1,
    cylinder: 1,
    shrimp: 2
}

// Every movable piece on the table: polyps and shrimps on the reefs; larva cubes, waiting
// polyps, alga cylinders and eaten shrimps on the open sea.
export function tablePieces(state: HydratedReefEncounterGameState, gameId: string): TablePiece[] {
    const pieces: TablePiece[] = []
    const centerOf = (box: BoundingBox): Point => ({
        x: box.x + box.width / 2,
        y: box.y + box.height / 2
    })

    const onSquare = (boardId: ReefBoardId, coords: { row: number; col: number }) =>
        `on board ${boardId}, row ${coords.row + 1}, column ${coords.col + 1}`

    for (const reef of state.reefs) {
        for (const { coords, color } of reef.polyps) {
            const box = boardSquare(coords)
            pieces.push({
                kind: 'polyp',
                key: `${reef.boardId}:polyp:${coords.row},${coords.col}:${color}`,
                container: reef.boardId,
                center: centerOf(box),
                place: onSquare(reef.boardId, coords),
                color,
                box,
                url: polypFaceUrl(color, `${gameId}:${reef.boardId}:${coords.row}:${coords.col}`)
            })
        }
    }
    for (const { playerId, boardId, coords } of state.shrimps) {
        pieces.push({
            kind: 'shrimp',
            key: `${boardId}:shrimp:${coords.row},${coords.col}:${playerId}`,
            container: boardId,
            center: centerOf(boardSquare(coords)),
            place: onSquare(boardId, coords),
            playerId,
            upsideDown: false
        })
    }

    for (const space of state.openSea) {
        const { larvaColor, polyps } = space
        if (space.hasLarvaCube) {
            pieces.push({
                kind: 'cube',
                key: `sea:cube:${larvaColor}`,
                container: 'sea',
                center: larvaSpaceCube(larvaColor),
                place: `in the ${larvaColor} larva space`,
                color: larvaColor
            })
        }
        polyps.forEach((color, index) => {
            const box = larvaSpacePolyp(larvaColor, index, polyps.length)
            pieces.push({
                kind: 'polyp',
                // A space's polyps fan out by how many there are, so they move when that changes.
                key: `sea:polyp:${larvaColor}:${index}of${polyps.length}:${color}`,
                container: 'sea',
                center: centerOf(box),
                place: `in the ${larvaColor} larva space`,
                color,
                box,
                url: polypFaceUrl(color, `${gameId}:sea:${larvaColor}:${index}`),
                larvaSpace: larvaColor
            })
        })
    }
    if (state.openSeaAlga) {
        pieces.push({
            kind: 'cylinder',
            key: `sea:alga:${state.openSeaAlga}`,
            container: 'sea',
            center: AlgaSpace,
            place: 'on the open-sea cylinder space',
            color: state.openSeaAlga,
            size: 64
        })
    }
    state.coralTiles.forEach((tile, index) => {
        const box = coralTileSlot(index)
        const faces = CoralTileFaceUrls[tile.tileId]
        pieces.push({
            kind: 'coralTile',
            key: `sea:coralTile:${tile.tileId}:${tile.starfishSideUp ? 'starfish' : 'plain'}`,
            container: 'sea',
            center: centerOf(box),
            place: '',
            tileId: tile.tileId,
            face: faceUp(tile),
            starfishSideUp: tile.starfishSideUp,
            box,
            url: tile.starfishSideUp ? faces.starfish : faces.plain
        })
        if (tile.cylinder) {
            pieces.push({
                kind: 'cylinder',
                key: `sea:tile:${tile.tileId}:${tile.cylinder}`,
                container: 'sea',
                center: centerOf(coralTileSlot(index)),
                place: `locking coral tile ${tile.tileId}`,
                color: tile.cylinder,
                size: 56
            })
        }
    })
    state.turnManager.turnOrder.forEach((playerId, seat) => {
        if (state.getPlayerState(playerId).shrimpOnOpenSea) {
            pieces.push({
                kind: 'shrimp',
                key: `sea:shrimp:${playerId}`,
                container: 'sea',
                center: eatenShrimpSlot(seat),
                place: 'on the open sea, eaten',
                playerId,
                // Lying on its silhouette, which alternate in direction.
                upsideDown: seat % 2 === 1
            })
        }
    })

    return byLayer(pieces)
}

export function byLayer(pieces: TablePiece[]): TablePiece[] {
    return pieces.sort((a, b) => Layer[a.kind] - Layer[b.kind])
}

// A piece moving across its drawing: `source` is where it was, among the leaving pieces.
export type PieceMove = { piece: TablePiece; source: TablePiece }

// A coral tile turning over: `from` is its old face, among the leaving pieces.
export type PieceFlip = { piece: CoralTilePiece; from: CoralTilePiece }

export type PieceChanges = {
    arriving: TablePiece[]
    leaving: TablePiece[]
    // Arrivals that are a piece moving across the same drawing: a polyp shifting along its larva
    // space, or a shrimp moved along its reef.
    moves: PieceMove[]
    flips: PieceFlip[]
}

export function pieceChanges(from: readonly TablePiece[], to: readonly TablePiece[]): PieceChanges {
    const fromKeys = new Set(from.map((piece) => piece.key))
    const toKeys = new Set(to.map((piece) => piece.key))
    const leaving = from.filter((piece) => !toKeys.has(piece.key))
    const arrivals = to.filter((piece) => !fromKeys.has(piece.key))

    const unmatched = [...leaving]
    const moves: PieceMove[] = []
    const flips: PieceFlip[] = []
    const arriving: TablePiece[] = []
    for (const piece of arrivals) {
        if (piece.kind === 'coralTile') {
            const index = unmatched.findIndex(
                (old) => old.kind === 'coralTile' && old.tileId === piece.tileId
            )
            const old = unmatched[index]
            if (old?.kind === 'coralTile') {
                flips.push({ piece, from: old })
                unmatched.splice(index, 1)
                continue
            }
        }
        const index = unmatched.findIndex((old) => sameThing(old, piece))
        if (index < 0) {
            arriving.push(piece)
            continue
        }
        moves.push({ piece, source: unmatched[index] })
        unmatched.splice(index, 1)
    }
    return { arriving, leaving, moves, flips }
}

function sameThing(a: TablePiece, b: TablePiece): boolean {
    if (a.container !== b.container || a.kind !== b.kind) {
        return false
    }
    switch (a.kind) {
        case 'shrimp':
            return b.kind === 'shrimp' && a.playerId === b.playerId
        case 'polyp':
            // Only polyps on the open sea slide; on a reef a new polyp is a new tile.
            return (
                b.kind === 'polyp' &&
                a.larvaSpace !== undefined &&
                a.larvaSpace === b.larvaSpace &&
                a.color === b.color
            )
        default:
            return false
    }
}
