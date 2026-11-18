import { assertExists, type Point } from '@tabletop/common'
import {
    hexCapacity,
    isCityHex,
    RAILROAD_IDS,
    railroadsIn,
    type HexId,
    type RailroadId,
    type Track
} from '@tabletop/ride-the-rails'
import { hexCells, hexCenter, hexFrameOf } from './boardGeometry.js'
import { CUBE_EDGE_WIDTH, CUBE_UNIT } from './cubeShape.js'
import type { TrackSlot, TrackSlotLayout, TrackSlotOffsets } from './hexFrame.js'

export type { TrackSlot, TrackSlotLayout } from './hexFrame.js'

// R-4.1.3: one cube per railroad, so a hex with no limit never holds more than the six railroads.
export const MOST_LOCOMOTIVES_IN_A_HEX = RAILROAD_IDS.length

// Art plan, Cube slots: the slots of the hex's frame (`hexFrame`), placed from its centre.
function layoutOffsets(
    slots: TrackSlotOffsets,
    layout: TrackSlotLayout,
    held: number | undefined
): readonly TrackSlot[] {
    if (layout === 'chicago') {
        return (held === undefined ? undefined : slots.chicago[held]) ?? slots.byLayout.chicago
    }
    const lone = held === 1 ? slots.lone[layout] : undefined
    return lone ? [lone] : slots.byLayout[layout]
}

export function trackSlotLayout(hexId: HexId): TrackSlotLayout {
    const capacity = hexCapacity(hexId)
    if (capacity === 'unlimited') return 'chicago'
    if (capacity === 1) return 'east-coast-city'
    return isCityHex(hexId) ? 'city' : 'open-hex'
}

// R-8.5: how many of a twin city's cubes each of its two cells holds, by how many it holds.
const TWIN_SHARES: Readonly<Record<number, readonly [number, number]>> = {
    1: [1, 0],
    2: [1, 1],
    3: [2, 1],
    4: [2, 2],
    5: [3, 2],
    6: [3, 3]
}

/**
 * R-8.5: a city over two cells (Berlin) holds its cubes in turn in each cell, its own first: one
 * each full size, two each full size, then Chicago's small size at five or six.
 */
function twinSlots(hexId: HexId, held: number): TrackSlot[] {
    const cells = hexCells(hexId)
    const { twinCell } = hexFrameOf(hexId).trackSlots
    const shares = TWIN_SHARES[held] ?? TWIN_SHARES[MOST_LOCOMOTIVES_IN_A_HEX] ?? [0, 0]
    const small = held >= 5
    const cellSlots = (count: number): readonly TrackSlot[] =>
        count >= 3
            ? twinCell.three
            : count === 2
              ? small
                  ? twinCell.smallTwo
                  : twinCell.two
              : twinCell.one
    const [own, second] = cells.map((cell, index) =>
        cellSlots(shares[index] ?? 0).map((offset) => ({
            ...offset,
            x: cell.center.x + offset.x,
            y: cell.center.y + offset.y
        }))
    )
    return Array.from({ length: shares[0] + shares[1] }, (_, index) => {
        const slot = index % 2 === 0 ? own?.[index / 2] : second?.[(index - 1) / 2]
        assertExists(slot, `Hex ${hexId} has no twin slot ${index}`)
        return slot
    })
}

/** The hex's slots when it holds `held` cubes: a lone cube stands in the middle; Chicago's
 * cubes regroup as they arrive (CHICAGO_LAYOUTS); a city over two cells alternates them. */
export function trackSlots(hexId: HexId, held?: number): TrackSlot[] {
    if (hexCells(hexId).length > 1) return twinSlots(hexId, held ?? MOST_LOCOMOTIVES_IN_A_HEX)
    const center = hexCenter(hexId)
    const slots = hexFrameOf(hexId).trackSlots
    return layoutOffsets(slots, trackSlotLayout(hexId), held).map((offset) => ({
        ...offset,
        x: center.x + offset.x,
        y: center.y + offset.y
    }))
}

/**
 * The top of the highest cube the hex's own cell can ever hold, its edge included, from that
 * cell's centre: a city's row in every city, higher in one with no limit (R-4.1.3), whose small
 * cubes stand a top row from four railroads. Berlin's second cell is left out.
 */
export function highestCubeTop(hexId: HexId): number {
    const [own, ...others] = hexCells(hexId)
    assertExists(own, `Hex ${hexId} covers no cell`)
    const from = (slot: TrackSlot, center: Point) =>
        Math.hypot(slot.x - center.x, slot.y - center.y)
    const tops = Array.from({ length: MOST_LOCOMOTIVES_IN_A_HEX }, (_, index) =>
        trackSlots(hexId, index + 1)
    )
        .flat()
        .filter((slot) => others.every((cell) => from(slot, own.center) <= from(slot, cell.center)))
        .map((slot) => slot.y - own.center.y - slot.height / 2 - CUBE_EDGE_WIDTH / 2)
    return Math.min(...tops)
}

/** The slot of the hex's cube at this place in the hex's placement order, of `held` cubes. */
export function trackSlot(hexId: HexId, placementIndex: number, held: number): TrackSlot {
    const placedSlot = trackSlots(hexId, held)[placementIndex]
    assertExists(placedSlot, `Hex ${hexId} has no track slot ${placementIndex}`)
    return placedSlot
}

/** A ghost cube: the cube a railroad would place in a lit hex, in the slot it would take. */
export type GhostCube = TrackSlot & { railroadId: RailroadId }

/** How far railroads sharing one slot stand apart, in cube units, and their size there. */
export const SHARED_GHOST_SPREAD = { x: 3.2, y: 1.4 } as const
export const SHARED_GHOST_SCALE = 0.7

/**
 * R-4.1.4: each railroad that may build in the hex, in the slot its placement would take: the
 * next free slot, a second railroad the one after; a lone railroad in an empty hex stands in
 * the middle, where its cube would. A hex's held cube stands aside for its ghosts (see
 * `locomotivePieces`). Where fewer slots are free than railroads, all share the first free
 * slot, smaller, spread from back left to front right.
 */
export function ghostCubes(
    hexId: HexId,
    track: Track,
    railroadIds: readonly RailroadId[]
): GhostCube[] {
    const held = railroadsIn(track, hexId).length
    const free = trackSlots(hexId, held === 0 && railroadIds.length === 1 ? 1 : undefined).slice(
        held
    )
    if (free.length >= railroadIds.length) {
        return railroadIds.map((railroadId, index) => ({ ...free[index], railroadId }))
    }
    const shared = free[0]
    assertExists(shared, `Hex ${hexId} has no free track slot`)
    const cubeScale = shared.width / CUBE_UNIT
    const last = Math.max(railroadIds.length - 1, 1)
    return railroadIds.map((railroadId, index) => {
        const spread = (2 * index) / last - 1
        return {
            railroadId,
            x: shared.x + spread * SHARED_GHOST_SPREAD.x * cubeScale,
            y: shared.y + spread * SHARED_GHOST_SPREAD.y * cubeScale,
            width: shared.width * SHARED_GHOST_SCALE,
            height: shared.height * SHARED_GHOST_SCALE
        }
    })
}
