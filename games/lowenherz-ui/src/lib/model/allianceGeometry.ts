import type { Point } from '@tabletop/common'
import { BOARD_COLS, BOARD_ROWS, squareKey, type HydratedLowenherzGameState } from '@tabletop/lowenherz'
import { CELL_SIZE, scaled } from '$lib/model/boardMetrics.js'

export type AllianceWall = { col: number; row: number; edge: string }

/**
 * The boundary walls along an alliance's shared border - the walls that carry its hearts.
 *
 * Takes the state to read rather than closing over the session's, because the burst animator needs
 * the alliance from the `from` state: by the time a cancellation is applied the alliance is gone,
 * and during the animation the exposed state is still `from` anyway. That is what replaced a Map of
 * remembered wall positions refreshed after every action.
 *
 * "wall north of (c,r)" separates (c,r) from (c,r-1); "wall west of (c,r)" separates (c,r) from
 * (c-1,r) - see model/board.ts's wallBetween().
 */
export function allianceWalls(
    state: HydratedLowenherzGameState,
    allianceId: string
): AllianceWall[] {
    const alliance = state.alliances.find((candidate) => candidate.id === allianceId)
    if (!alliance) return []

    const regionA = state.regions.find((region) => region.id === alliance.regionAId)
    const regionB = state.regions.find((region) => region.id === alliance.regionBId)
    if (!regionA || !regionB) return []

    return state.board.walls.filter((wall) => {
        const keyHere = squareKey(wall.col, wall.row)
        const keyThere =
            wall.edge === 'north'
                ? squareKey(wall.col, wall.row - 1)
                : squareKey(wall.col - 1, wall.row)
        return (
            (regionA.squareKeys.includes(keyHere) && regionB.squareKeys.includes(keyThere)) ||
            (regionB.squareKeys.includes(keyHere) && regionA.squareKeys.includes(keyThere))
        )
    })
}

export type HeartPosition = { left: number; top: number }

export const HEART_BOX = scaled(12)

const HEART_OFFSETS_ALONG_WALL = [0.3, 0.7]

/**
 * Where an alliance's hearts sit along one of its boundary walls. Shared by the hearts themselves
 * and by the form/burst animators, so a burst cannot start anywhere but exactly where its heart was.
 */
export function heartPositions(wall: AllianceWall): HeartPosition[] {
    const half = HEART_BOX / 2
    return HEART_OFFSETS_ALONG_WALL.map((offset) => ({
        left: (wall.edge === 'west' ? wall.col : wall.col + offset) * CELL_SIZE - half,
        top: (wall.edge === 'west' ? wall.row + offset : wall.row) * CELL_SIZE - half
    }))
}

export type HeartSpan = {
    left: number
    top: number
    width: number
    height: number
    hearts: HeartPosition[]
}

/** The box enclosing a wall's hearts, with the hearts placed relative to it. */
export function heartSpan(wall: AllianceWall): HeartSpan {
    const positions = heartPositions(wall)
    const left = Math.min(...positions.map((position) => position.left))
    const top = Math.min(...positions.map((position) => position.top))
    return {
        left,
        top,
        width: Math.max(...positions.map((position) => position.left)) - left + HEART_BOX,
        height: Math.max(...positions.map((position) => position.top)) - top + HEART_BOX,
        hearts: positions.map((position) => ({ left: position.left - left, top: position.top - top }))
    }
}

function wallEndpoints(wall: AllianceWall): [Point, Point] {
    const start = { x: wall.col * CELL_SIZE, y: wall.row * CELL_SIZE }
    return wall.edge === 'west'
        ? [start, { x: start.x, y: start.y + CELL_SIZE }]
        : [start, { x: start.x + CELL_SIZE, y: start.y }]
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const along = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)
    const t = Math.min(1, Math.max(0, along))
    return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy))
}

export function distanceToWall(point: Point, wall: AllianceWall): number {
    const [start, end] = wallEndpoints(wall)
    return distanceToSegment(point, start, end)
}

type Rect = { left: number; top: number; right: number; bottom: number }

// "Break alliance?" at the pill's cell-relative font, with a little slack: the text is fixed and
// the font scales with the cell, so its footprint in cells is constant. A second, smaller line
// names a Treasure payment when there is one.
const PILL_WIDTH = 3.3 * CELL_SIZE
const PILL_HEIGHT = 0.65 * CELL_SIZE
const PILL_HEIGHT_WITH_DETAIL = 0.95 * CELL_SIZE

function pillSize(withDetail: boolean) {
    return { width: PILL_WIDTH, height: withDetail ? PILL_HEIGHT_WITH_DETAIL : PILL_HEIGHT }
}
const PILL_GAP_FROM_WALL = 0.3 * CELL_SIZE
const PILL_SEARCH_STEP = 0.25 * CELL_SIZE
const PILL_SEARCH_STEPS = 4
const PILL_BOARD_MARGIN = 0.15 * CELL_SIZE
const PILL_HOVER_PADDING = 0.4 * CELL_SIZE

function wallMidpoint(wall: AllianceWall): Point {
    const [start, end] = wallEndpoints(wall)
    return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
}

function heartRects(walls: AllianceWall[]): Rect[] {
    return walls.flatMap((wall) =>
        heartPositions(wall).map((heart) => ({
            left: heart.left,
            top: heart.top,
            right: heart.left + HEART_BOX,
            bottom: heart.top + HEART_BOX
        }))
    )
}

function pillRectAround(centre: Point, withDetail: boolean): Rect {
    const { width, height } = pillSize(withDetail)
    return {
        left: centre.x - width / 2,
        top: centre.y - height / 2,
        right: centre.x + width / 2,
        bottom: centre.y + height / 2
    }
}

function intersects(a: Rect, b: Rect): boolean {
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

function withinBoard(rect: Rect): boolean {
    return (
        rect.left >= PILL_BOARD_MARGIN &&
        rect.top >= PILL_BOARD_MARGIN &&
        rect.right <= BOARD_COLS * CELL_SIZE - PILL_BOARD_MARGIN &&
        rect.bottom <= BOARD_ROWS * CELL_SIZE - PILL_BOARD_MARGIN
    )
}

/** Spots off each face of the wall and past each of its ends, nearest first. */
function pillCandidatesAround(
    wall: AllianceWall,
    withDetail: boolean
): { centre: Point; reach: number }[] {
    const mid = wallMidpoint(wall)
    const vertical = wall.edge === 'west'
    const { width, height } = pillSize(withDetail)
    const candidates: { centre: Point; reach: number }[] = []
    for (let step = 0; step < PILL_SEARCH_STEPS; step++) {
        const reach = PILL_GAP_FROM_WALL + step * PILL_SEARCH_STEP
        for (const sign of [-1, 1]) {
            const offFace = vertical
                ? { x: mid.x + sign * (width / 2 + reach), y: mid.y }
                : { x: mid.x, y: mid.y + sign * (height / 2 + reach) }
            const pastEnd = vertical
                ? { x: mid.x, y: mid.y + sign * (CELL_SIZE / 2 + height / 2 + reach) }
                : { x: mid.x + sign * (CELL_SIZE / 2 + width / 2 + reach), y: mid.y }
            candidates.push({ centre: offFace, reach }, { centre: pastEnd, reach })
        }
    }
    return candidates
}

type PillPlacement = { anchor: Point; fromWall: AllianceWall }

function borderCentre(walls: AllianceWall[]): Point {
    const midpoints = walls.map(wallMidpoint)
    return {
        x: midpoints.reduce((sum, p) => sum + p.x, 0) / midpoints.length,
        y: midpoints.reduce((sum, p) => sum + p.y, 0) / midpoints.length
    }
}

/**
 * Where the "Break alliance?" pill sits: the spot nearest the border's centre that is off one of
 * its walls, clear of every heart along the border, and inside the board - together with the wall
 * it was placed off, which anchors the hover corridor leading to it.
 */
function breakAlliancePillPlacement(walls: AllianceWall[], withDetail: boolean): PillPlacement {
    const hearts = heartRects(walls)
    const centre = borderCentre(walls)
    let best: { placement: PillPlacement; score: number } | undefined
    for (const wall of walls) {
        for (const candidate of pillCandidatesAround(wall, withDetail)) {
            const rect = pillRectAround(candidate.centre, withDetail)
            if (!withinBoard(rect) || hearts.some((heart) => intersects(rect, heart))) continue
            const score =
                Math.hypot(candidate.centre.x - centre.x, candidate.centre.y - centre.y) + candidate.reach
            if (!best || score < best.score) {
                best = { placement: { anchor: candidate.centre, fromWall: wall }, score }
            }
        }
    }
    return best?.placement ?? { anchor: centre, fromWall: walls[0] }
}

export function breakAlliancePillAnchor(walls: AllianceWall[], withDetail: boolean): Point {
    return breakAlliancePillPlacement(walls, withDetail).anchor
}

/**
 * How far the pointer is from offering this alliance's pill: zero over the pill's own (padded)
 * footprint, otherwise the nearest of its walls and of the corridor from the wall the pill was
 * placed off to the pill - so the pointer can travel from the hearts to the pill without the
 * offer lapsing on the way.
 */
export function breakAllianceOfferDistance(
    point: Point,
    walls: AllianceWall[],
    withDetail: boolean
): number {
    const { anchor, fromWall } = breakAlliancePillPlacement(walls, withDetail)
    const pill = pillRectAround(anchor, withDetail)
    if (
        point.x >= pill.left - PILL_HOVER_PADDING &&
        point.x <= pill.right + PILL_HOVER_PADDING &&
        point.y >= pill.top - PILL_HOVER_PADDING &&
        point.y <= pill.bottom + PILL_HOVER_PADDING
    ) {
        return 0
    }
    const corridor = distanceToSegment(point, wallMidpoint(fromWall), anchor)
    return Math.min(corridor, ...walls.map((wall) => distanceToWall(point, wall)))
}
