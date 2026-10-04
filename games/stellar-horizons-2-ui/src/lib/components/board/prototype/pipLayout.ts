// PROTOTYPE: placement of ship pips around a system's star, avoiding worlds and printed art.
import type { Point } from '@tabletop/common'
import type { SystemFrame } from '$lib/utils/boardLayout.js'
import type { DisplayShip, FactionGroup } from './prototypeState.svelte.js'

export const LARGEST_PIP = 34
const SMALLEST_PIP = 9
const WORLD_RADIUS = 56
const STAR_RADIUS = 30

export interface Obstacle {
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

export interface PlacedPip {
    ship: DisplayShip
    x: number
    y: number
}

export interface PipLayout {
    r: number
    pips: PlacedPip[]
}

export function obstacles(frame: SystemFrame): Obstacle[] {
    return [
        ...frame.slots.map((slot) => ({ ...slot, r: WORLD_RADIUS })),
        { ...frame.marker, r: 40 },
        { ...frame.bases, r: 38 },
        { x: 0, y: 0, r: STAR_RADIUS }
    ]
}

function printedText(frame: SystemFrame): Box[] {
    return [
        {
            left: -frame.width * 0.3,
            top: -frame.height * 0.5,
            right: frame.width * 0.3,
            bottom: -frame.height * 0.37
        },
        {
            left: -frame.width * 0.4,
            top: frame.height * 0.2,
            right: frame.width * 0.06,
            bottom: frame.height * 0.5
        }
    ]
}

function clearOfBox(point: Point, box: Box, r: number): boolean {
    const dx = Math.max(box.left - point.x, 0, point.x - box.right)
    const dy = Math.max(box.top - point.y, 0, point.y - box.bottom)
    return Math.hypot(dx, dy) > r
}

export function isFree(point: Point, blocked: Obstacle[], frame: SystemFrame, r: number, gap = 2) {
    const inside = Math.hypot(point.x, point.y) < frame.height * 0.47 - r
    return (
        inside &&
        printedText(frame).every((box) => clearOfBox(point, box, r + gap)) &&
        blocked.every((o) => Math.hypot(point.x - o.x, point.y - o.y) > o.r + r + gap)
    )
}

export function ringPositions(radius: number, blocked: Obstacle[], frame: SystemFrame, r: number) {
    const count = Math.floor((Math.PI * 2 * radius) / (r * 2.2))
    return Array.from({ length: count }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / count
        return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
    }).filter((point) => isFree(point, blocked, frame, r))
}

export function ringRadii(frame: SystemFrame, r: number): number[] {
    const radii: number[] = []
    for (let radius = frame.height * 0.45 - r; radius > STAR_RADIUS + r; radius -= r * 2.15) {
        radii.push(radius)
    }
    return radii
}

export function flowAcrossRings(sequence: (DisplayShip | undefined)[], rings: Point[][]) {
    const slots = rings.flat()
    return sequence.flatMap((ship, index) => {
        const slot = slots[index]
        return ship && slot ? [{ ship, ...slot }] : []
    })
}

export function factionSequence(groups: FactionGroup[]): (DisplayShip | undefined)[] {
    return groups.flatMap((group, index) =>
        index < groups.length - 1 ? [...group.ships, undefined] : group.ships
    )
}

export function fitPips(total: number, layout: (r: number) => PlacedPip[]): PipLayout {
    let r = LARGEST_PIP
    let pips = layout(r)
    while (pips.length < total && r > SMALLEST_PIP) {
        r = Math.max(SMALLEST_PIP, r * 0.9)
        pips = layout(r)
    }
    return { r, pips }
}

export function honeycomb(count: number, spacing: number): Point[] {
    const cells: Point[] = [{ x: 0, y: 0 }]
    const directions = [0, 1, 2, 3, 4, 5].map((k) => (Math.PI / 3) * k)
    for (let ring = 1; cells.length < count; ring++) {
        let x = Math.cos(directions[4]) * spacing * ring
        let y = Math.sin(directions[4]) * spacing * ring
        for (let side = 0; side < 6; side++) {
            for (let step = 0; step < ring; step++) {
                cells.push({ x, y })
                x += Math.cos(directions[side]) * spacing
                y += Math.sin(directions[side]) * spacing
            }
        }
    }
    const used = cells.slice(0, count)
    const cx = used.reduce((sum, cell) => sum + cell.x, 0) / used.length
    const cy = used.reduce((sum, cell) => sum + cell.y, 0) / used.length
    return used.map((cell) => ({ x: cell.x - cx, y: cell.y - cy }))
}
