import { samePoint, type Point } from '@tabletop/common'
import type { HydratedMedinaGameState, PalaceColor, Rooftop, WallSection } from '@tabletop/medina'
import {
    convexHull,
    footprint,
    isWallAcross,
    polygonPoints,
    project,
    towerWorlds,
    worldOfSpace,
    worldOfWall,
    type BoardProjection
} from './boardGeometry.js'
import type { RecentPlacement } from './recentPlacements.js'

export type BoardPiece = {
    key: string
    sprite: string
    anchor: Point
    rooftop?: { key: string; sprite: string; place: string; markAt: Point }
    palaceId?: string
    place?: string
    outline?: string
    markAt?: Point
    groundMark?: string
    tintedWhenRecent?: boolean
}

export type RooftopSprite = (rooftop: Rooftop) => string

const PIECE_SHAPES = {
    palace: { half: 0.47, height: 0.645, rooftopHeight: 0.36, variants: 3 },
    stable: { half: 0.42, height: 0.36, variants: 3 },
    merchant: { variants: 2 }
}
const MERCHANT_SQUARE_HALF = 0.4
export const RECENT_DOT_RADIUS = 11
// A building and the rooftop on it marked together share the rooftop, side by side.
const PAIRED_MARK_SHIFT = RECENT_DOT_RADIUS + 1
const WALL_VARIANTS = 2
const ROOFTOP_VARIANTS = 2

function spaceHash(space: Point): number {
    return Math.abs((space.x * 73856093) ^ (space.y * 19349663))
}

function outlineOf(
    projection: BoardProjection,
    world: Point,
    halfX: number,
    halfY: number,
    height: number
): string {
    return polygonPoints(
        convexHull([
            ...footprint(projection, world, halfX, halfY),
            ...footprint(projection, world, halfX, halfY, height)
        ])
    )
}

export function spacePlace(space: Point): string {
    return `space:${space.x},${space.y}`
}

export function recentPlace(placement: RecentPlacement): string {
    if ('wall' in placement) {
        return wallKey(placement.wall.side, placement.wall.position)
    }
    return 'roof' in placement ? spaceKey('roof', placement.roof) : spacePlace(placement.space)
}

export type RecentMark = {
    key: string
    piece: BoardPiece
    playerId: string
    at: Point | undefined
    onRoof: boolean
}

// A rooftop is a place of its own, so the building under it keeps the mark of whoever placed it.
export function recentMarks(pieces: BoardPiece[], recent: RecentPlacement[]): RecentMark[] {
    const byPlace = new Map<string, Omit<RecentMark, 'key' | 'playerId'>>()
    for (const piece of pieces) {
        if (piece.place) {
            byPlace.set(piece.place, { piece, at: piece.markAt, onRoof: false })
        }
        if (piece.rooftop) {
            byPlace.set(piece.rooftop.place, { piece, at: piece.rooftop.markAt, onRoof: true })
        }
    }
    const seen = new Set<string>()
    const marks: RecentMark[] = recent.flatMap((placement) => {
        const key = recentPlace(placement)
        const mark = byPlace.get(key)
        if (!mark || seen.has(key)) {
            return []
        }
        seen.add(key)
        return [{ key, playerId: placement.playerId, ...mark }]
    })
    return marks.map((mark) => {
        const paired = marks.filter((other) => other.piece === mark.piece).length > 1
        if (!paired || !mark.piece.rooftop || !mark.at) {
            return mark
        }
        const shift = mark.onRoof ? PAIRED_MARK_SHIFT : -PAIRED_MARK_SHIFT
        return { ...mark, at: { x: mark.at.x + shift, y: mark.at.y } }
    })
}

export function buildingSprite(color: PalaceColor, space: Point): string {
    return `palace-${color}-${spaceHash(space) % PIECE_SHAPES.palace.variants}`
}

export function stableSprite(space: Point): string {
    return `stable-${spaceHash(space) % PIECE_SHAPES.stable.variants}`
}

export function merchantSprite(space: Point): string {
    return `merchant-${spaceHash(space) % PIECE_SHAPES.merchant.variants}`
}

export function wallSprite(section: WallSection, sideways: boolean): string {
    const direction = isWallAcross(section, sideways) ? 'h' : 'v'
    return `wall-${direction}-${section.position % WALL_VARIANTS}`
}

export function rooftopOn(sprite: string, space: Point): string {
    return `${sprite}-${spaceHash(space) % ROOFTOP_VARIANTS}`
}

export function spaceKey(kind: string, space: Point): string {
    return `${kind}:${space.x},${space.y}`
}

export function wallKey(side: string, position: number): string {
    return `wall:${side},${position}`
}

export function rooftopKey(palaceId: string): string {
    return `rooftop:${palaceId}`
}

// Far to near; along a row west to east, because the camera sees east faces.
export function paintOrder(a: Pick<BoardPiece, 'anchor'>, b: Pick<BoardPiece, 'anchor'>): number {
    return a.anchor.y - b.anchor.y || a.anchor.x - b.anchor.x
}

export function boardPieces(
    state: HydratedMedinaGameState,
    projection: BoardProjection,
    rooftopSprite: RooftopSprite
): BoardPiece[] {
    const { size } = projection
    const pieces: BoardPiece[] = []

    for (const building of state.buildings) {
        const palace = state.palace(building.palaceId)
        const world = worldOfSpace(building.coords, size)
        const roof = palace.rooftop
        const roofed = roof && samePoint(roof.coords, building.coords)
        const shape = PIECE_SHAPES.palace
        pieces.push({
            key: spaceKey('building', building.coords),
            sprite: buildingSprite(palace.color, building.coords),
            anchor: project(projection, world),
            palaceId: palace.id,
            rooftop: roofed
                ? {
                      key: rooftopKey(palace.id),
                      sprite: rooftopOn(rooftopSprite(roof), building.coords),
                      place: spaceKey('roof', building.coords),
                      markAt: project(projection, world, shape.height + shape.rooftopHeight)
                  }
                : undefined,
            place: spacePlace(building.coords),
            markAt: project(projection, world, shape.height + (roofed ? shape.rooftopHeight : 0)),
            outline: outlineOf(
                projection,
                world,
                shape.half,
                shape.half,
                shape.height + (roofed ? shape.rooftopHeight : 0)
            )
        })
    }
    for (const stable of state.stables) {
        const world = worldOfSpace(stable.coords, size)
        const shape = PIECE_SHAPES.stable
        pieces.push({
            key: spaceKey('stable', stable.coords),
            sprite: stableSprite(stable.coords),
            anchor: project(projection, world),
            palaceId: stable.palaceId,
            place: spacePlace(stable.coords),
            markAt: project(projection, world, shape.height),
            outline: outlineOf(projection, world, shape.half, shape.half, shape.height)
        })
    }
    for (const merchant of state.merchants()) {
        const world = worldOfSpace(merchant, size)
        pieces.push({
            key: spaceKey('merchant', merchant),
            sprite: merchantSprite(merchant),
            anchor: project(projection, world),
            place: spacePlace(merchant),
            groundMark: polygonPoints(
                footprint(projection, world, MERCHANT_SQUARE_HALF, MERCHANT_SQUARE_HALF)
            )
        })
    }
    pieces.push({
        key: 'well',
        sprite: 'well-0',
        anchor: project(projection, worldOfSpace(state.well, size))
    })
    for (const wall of state.walls) {
        const world = worldOfWall(wall, size)
        pieces.push({
            key: wallKey(wall.side, wall.position),
            sprite: wallSprite(wall, projection.sideways),
            anchor: project(projection, world),
            place: wallKey(wall.side, wall.position),
            tintedWhenRecent: true
        })
    }
    towerWorlds(size).forEach((world, index) => {
        pieces.push({
            key: `tower:${index}`,
            sprite: 'tower-0',
            anchor: project(projection, world)
        })
    })
    return pieces.toSorted(paintOrder)
}

export function scoringPieceKeys(state: HydratedMedinaGameState, palaceId: string): Set<string> {
    return new Set([
        ...state.palaceBuildings(palaceId).map((space) => spaceKey('building', space)),
        ...state.palaceStables(palaceId).map((space) => spaceKey('stable', space)),
        ...state.palaceMerchants(palaceId).map((space) => spaceKey('merchant', space)),
        ...state.wallsBeside(palaceId).map((wall) => wallKey(wall.side, wall.position))
    ])
}
