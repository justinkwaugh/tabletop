import {
    HexOrientation,
    PointyHexDirection,
    PointyNeighborOffsets,
    addAxial,
    assertExists,
    calculateHexGeometry,
    roundNumber,
    sameCoordinates,
    type BoundingBox,
    type Point
} from '@tabletop/common'
import {
    BOARD_GRID,
    PROMONTORY,
    UNCOVERED_RED_TILES_AT_END,
    isRedTile,
    uncoveredRedTileCount,
    type PromontoryPointProjectedState,
    type RailroadId,
    type SpaceId,
    type TownTileKindId
} from '@tabletop/promontory-point'
import {
    BORDER_TRACK_LENGTH,
    BORDER_TRACK_SPACES,
    HEX,
    MAP_SIZE,
    PRICE_TRACK_SPACES,
    SPACE_CENTRES
} from './boardGeometry.js'

// R-1.3, O-6: a town tile is clipped to a hex a little larger than the printed village hex.
export const TOWN_TILE_SCALE = 0.8

// R-X.4, O-5: a track piece is a round token alone, smaller than a town tile, so a covered red
// tile's border still reads around it.
export const TRACK_PIECE_RADIUS = HEX.xRadius * 0.5

export function localHexPoints(scale: number): Point[] {
    return calculateHexGeometry(
        {
            orientation: HexOrientation.Pointy,
            dimensions: { xRadius: HEX.xRadius * scale, yRadius: HEX.yRadius * scale }
        },
        { q: 0, r: 0 }
    ).vertices
}

export function pointsAttribute(points: readonly Point[]): string {
    return points.map(({ x, y }) => `${x},${y}`).join(' ')
}

// O-6: the number tiles print their number sideways, so they turn a quarter turn clockwise; the
// red tiles are drawn as supplied.
export function townTileRotation(kindId: TownTileKindId): number {
    return isRedTile(kindId) ? 0 : 90
}

export function spaceCentre(spaceId: SpaceId): Point {
    const centre = SPACE_CENTRES.get(spaceId)
    assertExists(centre, `${spaceId} has no measured centre`)
    return centre
}

// The veil over the board while a pick is open: one path, the whole map less a hole at each lit hex.
export function veilPath(lit: readonly SpaceId[]): string {
    const { width, height } = MAP_SIZE
    const holes = lit.map((spaceId) => {
        const centre = spaceCentre(spaceId)
        const [first, ...rest] = localHexPoints(1).map((point) => ({
            x: centre.x + point.x,
            y: centre.y + point.y
        }))
        return `M${pathPoint(first)} ${rest.map((point) => `L${pathPoint(point)}`).join(' ')} Z`
    })
    return [`M0 0 H${width} V${height} H0 Z`, ...holes].join(' ')
}

// R-1.2: each railroad keeps its own slot in a row, so markers on one value sit side by side, and
// each of the five 0 spaces is its own row.
export function priceMarkerSlot(railroadId: RailroadId, priceIndex: number): BoundingBox {
    const space = PRICE_TRACK_SPACES.at(priceIndex)
    assertExists(space, `Price index ${priceIndex} is off the track`)
    return space.slots[railroadId]
}

export type MoneyMarker = {
    playerId: string
    box: BoundingBox
    shared: boolean
    // R-1.3-H1, R-1.1-H2: the hundreds the 0–99 track cannot show; the marker stands at the rest.
    overflow: number
}

// R-1.3-H1: the border-track space for an amount, and the "+100" (or "+200") past it.
export function moneySpace(money: number): number {
    return ((money % BORDER_TRACK_LENGTH) + BORDER_TRACK_LENGTH) % BORDER_TRACK_LENGTH
}

export function moneyOverflow(money: number): number {
    return money - moneySpace(money)
}

// R-1.3-H1: one marker per seat on the 0–99 border track. A seat alone takes its space whole;
// two or more share it as a 2×2 grid, in seat order.
export function moneyMarkers(seats: readonly { playerId: string; money: number }[]): MoneyMarker[] {
    return seats.map(({ playerId, money }) => {
        const space = BORDER_TRACK_SPACES[moneySpace(money)]
        const sharing = seats.filter((seat) => moneySpace(seat.money) === space.value)
        const shared = sharing.length > 1
        const box = shared
            ? space.sharingSlots[sharing.findIndex((seat) => seat.playerId === playerId)]
            : space.box
        return { playerId, box, shared, overflow: moneyOverflow(money) }
    })
}

export type EndTrackerStatus = {
    redTilesUncovered: number
    redTilesMet: boolean
    promontoryTaken: boolean
}

// R-6.1, R-6.1-H1: read from the board itself, so the tracker always matches it.
export function endTrackerStatus(
    state: Pick<PromontoryPointProjectedState, 'towns' | 'track'>
): EndTrackerStatus {
    const redTilesUncovered = uncoveredRedTileCount(state)
    return {
        redTilesUncovered,
        redTilesMet: redTilesUncovered <= UNCOVERED_RED_TILES_AT_END,
        promontoryTaken: PROMONTORY.spaceId in state.track
    }
}

export enum ChipPlacement {
    Above = 'Above',
    Below = 'Below',
    Inside = 'Inside'
}

// O-3: a chip sits above its hex, over the row above; below when a hex there is lit; inside its
// own hex when both rows are, so a chip never covers another lit hex.
export function chipPlacement(spaceId: SpaceId, lit: readonly SpaceId[]): ChipPlacement {
    const coords = BOARD_GRID.requireSpace(spaceId).coords
    const litCoords = lit.map((other) => BOARD_GRID.requireSpace(other).coords)
    const anyLit = (...directions: PointyHexDirection[]) =>
        directions.some((direction) => {
            const neighbour = addAxial(coords, PointyNeighborOffsets[direction])
            return litCoords.some((other) => sameCoordinates(other, neighbour))
        })
    if (!anyLit(PointyHexDirection.Northwest, PointyHexDirection.Northeast)) {
        return ChipPlacement.Above
    }
    if (!anyLit(PointyHexDirection.Southwest, PointyHexDirection.Southeast)) {
        return ChipPlacement.Below
    }
    return ChipPlacement.Inside
}

// Colour is never the only cue: each word's first letter, at most two ("Mara" M, "Player 2" P2).
export function seatInitials(name: string): string {
    return name
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .slice(0, 2)
        .map((word) => word[0].toUpperCase())
        .join('')
}

function pathPoint({ x, y }: Point): string {
    return `${roundNumber(x, 1)} ${roundNumber(y, 1)}`
}
