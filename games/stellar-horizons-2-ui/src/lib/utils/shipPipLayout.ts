import type { Point } from '@tabletop/common'
import {
    FACTIONS,
    type HydratedStellarHorizonsGameState,
    type ShipState
} from '@tabletop/stellar-horizons-2'
import type { SystemFrame } from './boardLayout.js'

export const LARGEST_PIP_RADIUS = 34
const SMALLEST_PIP_RADIUS = 9
const SHRINK_STEP = 0.9
const PIP_SPACING = 2.2
const WORLD_CLEARANCE = 56
const MARKER_CLEARANCE = 40
const BASE_CLEARANCE = 38
const STAR_CLEARANCE = 30
const CLUMP_GAP = 3
const ORBIT_STEPS = 90
const ORBIT_OFFSETS: readonly number[] = Array.from(
    { length: 25 },
    (_, index) => index * 10 - 140
).sort((a, b) => Math.abs(a) - Math.abs(b))

export interface ShipPip {
    ship: ShipState
    x: number
    y: number
}

export interface ShipPipLayout {
    radius: number
    pips: ShipPip[]
}

interface Circle {
    x: number
    y: number
    r: number
}

interface Box {
    left: number
    top: number
    right: number
    bottom: number
}

export function factionShipGroups(
    state: HydratedStellarHorizonsGameState,
    systemId: string
): ShipState[][] {
    const here = state.ships.filter((ship) => ship.systemId === systemId)
    return FACTIONS.flatMap(({ faction }) => {
        const ships = here.filter((ship) => state.getPlayerState(ship.playerId).faction === faction)
        return ships.length > 0 ? [ships] : []
    })
}

export function shipPipLayout(frame: SystemFrame, groups: readonly ShipState[][]): ShipPipLayout {
    const total = groups.reduce((sum, group) => sum + group.length, 0)
    let radius = LARGEST_PIP_RADIUS
    let pips = arrangeClumps(frame, groups, radius, false)
    while (pips.length < total && radius > SMALLEST_PIP_RADIUS) {
        radius = Math.max(SMALLEST_PIP_RADIUS, radius * SHRINK_STEP)
        pips = arrangeClumps(frame, groups, radius, false)
    }
    if (pips.length < total) {
        pips = arrangeClumps(frame, groups, radius, true)
    }
    return { radius, pips }
}

function arrangeClumps(
    frame: SystemFrame,
    groups: readonly ShipState[][],
    r: number,
    splitCrowdedClumps: boolean
): ShipPip[] {
    const blocked = staticObstacles(frame)
    const text = printedText(frame)
    const orbit = orbitRadius(frame)
    const isFree = (point: Point) =>
        Math.hypot(point.x, point.y) < frame.height * 0.47 - r &&
        text.every((box) => distanceToBox(point, box) > r + 1) &&
        blocked.every((o) => Math.hypot(point.x - o.x, point.y - o.y) > o.r + r + 1)

    let cursor = -Math.PI / 2
    const placeClump = (group: readonly ShipState[]): ShipPip[] => {
        const cells = honeycomb(group.length, r * PIP_SPACING)
        const extent = Math.max(...cells.map((cell) => Math.hypot(cell.x, cell.y))) + r
        for (let step = 0; step < ORBIT_STEPS; step++) {
            const angle = cursor + (step * Math.PI * 2) / ORBIT_STEPS
            for (const offset of ORBIT_OFFSETS) {
                const distance = orbit + offset
                const center = { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance }
                const placed = cells.map((cell) => ({ x: center.x + cell.x, y: center.y + cell.y }))
                if (!placed.every(isFree)) continue
                blocked.push({ ...center, r: extent + CLUMP_GAP })
                cursor = angle + (extent * 2) / Math.max(distance, 1)
                return group.map((ship, index) => ({ ship, ...placed[index] }))
            }
        }
        if (!splitCrowdedClumps || group.length === 1) {
            return []
        }
        const half = Math.ceil(group.length / 2)
        return [...placeClump(group.slice(0, half)), ...placeClump(group.slice(half))]
    }
    return groups.flatMap(placeClump)
}

function orbitRadius(frame: SystemFrame): number {
    if (frame.slots.length === 0) {
        return frame.height * 0.28
    }
    return (
        frame.slots.reduce((sum, slot) => sum + Math.hypot(slot.x, slot.y), 0) / frame.slots.length
    )
}

function staticObstacles(frame: SystemFrame): Circle[] {
    return [
        ...frame.slots.map((slot) => ({ ...slot, r: WORLD_CLEARANCE })),
        { ...frame.marker, r: MARKER_CLEARANCE },
        { ...frame.bases, r: BASE_CLEARANCE },
        { x: 0, y: 0, r: STAR_CLEARANCE }
    ]
}

function printedText(frame: SystemFrame): Box[] {
    const { width, height } = frame
    return [
        { left: -width * 0.3, top: -height * 0.5, right: width * 0.3, bottom: -height * 0.37 },
        { left: -width * 0.4, top: height * 0.2, right: width * 0.06, bottom: height * 0.5 }
    ]
}

function distanceToBox(point: Point, box: Box): number {
    const dx = Math.max(box.left - point.x, 0, point.x - box.right)
    const dy = Math.max(box.top - point.y, 0, point.y - box.bottom)
    return Math.hypot(dx, dy)
}

export function honeycomb(count: number, spacing: number): Point[] {
    const cells: Point[] = [{ x: 0, y: 0 }]
    const directions = [0, 1, 2, 3, 4, 5].map((k) => (Math.PI / 3) * k)
    for (let ring = 1; cells.length < count; ring++) {
        let x = Math.cos(directions[4]) * spacing * ring
        let y = Math.sin(directions[4]) * spacing * ring
        for (const direction of directions) {
            for (let step = 0; step < ring; step++) {
                cells.push({ x, y })
                x += Math.cos(direction) * spacing
                y += Math.sin(direction) * spacing
            }
        }
    }
    const used = cells.slice(0, count)
    const cx = used.reduce((sum, cell) => sum + cell.x, 0) / used.length
    const cy = used.reduce((sum, cell) => sum + cell.y, 0) / used.length
    return used.map((cell) => ({ x: cell.x - cx, y: cell.y - cy }))
}
