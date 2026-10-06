import {
    ClockwisePointyHexDirections,
    sameCoordinates,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { neighborCoords } from '@tabletop/magna-grecia'
import { HEX, hexCenter } from './boardGeometry.js'

export type CityEdge = { from: Point; to: Point }

export type CityHouse = { center: Point; length: number; depth: number; rotation: number }

export type CityLayout = {
    tiles: Point[]
    edges: CityEdge[]
    houses: CityHouse[]
    temple?: Point
}

const TEMPLE_RISE = 10
const TEMPLE_CLEARANCE = { x: 24, y: 18 }
const FIRST_TERRACE = 25
const TERRACE_SPACING = 12.5
const TERRACE_SQUASH = 0.92
const TERRACE_TWIST = 0.37
const EDGE_CLEARANCE = 6.5
const HOUSE_LENGTH = { min: 5, spread: 5 }
const HOUSE_DEPTH = { min: 5, spread: 2 }
const HOUSE_GAP = 2.8
const LANE = { chance: 0.22, gap: 8 }
const MISSING_HOUSE_CHANCE = 0.12
const RADIAL_JITTER = 2.4
const ROTATION_JITTER = 8

// Corner i and i + 1 bound the edge facing ClockwisePointyHexDirections[i].
const CORNERS: Point[] = [
    { x: HEX.xRadius, y: -HEX.yRadius / 2 },
    { x: HEX.xRadius, y: HEX.yRadius / 2 },
    { x: 0, y: HEX.yRadius },
    { x: -HEX.xRadius, y: HEX.yRadius / 2 },
    { x: -HEX.xRadius, y: -HEX.yRadius / 2 },
    { x: 0, y: -HEX.yRadius }
]

export function cityLayout(spaces: AxialCoordinates[], founding: AxialCoordinates): CityLayout {
    const tiles = spaces.map(hexCenter)
    const edges = outerEdges(spaces)
    const foundingCenter = hexCenter(founding)
    const anchor = { x: foundingCenter.x, y: foundingCenter.y - TEMPLE_RISE }
    const hasTemple = spaces.some((space) => sameCoordinates(space, founding))
    return {
        tiles,
        edges,
        houses: terraceHouses(anchor, tiles, edges),
        temple: hasTemple ? anchor : undefined
    }
}

export function outerEdges(spaces: AxialCoordinates[]): CityEdge[] {
    return spaces.flatMap((space) => {
        const center = hexCenter(space)
        return ClockwisePointyHexDirections.flatMap((direction, index) => {
            const neighbor = neighborCoords(space, direction)
            if (spaces.some((other) => sameCoordinates(other, neighbor))) {
                return []
            }
            const from = CORNERS[index]
            const to = CORNERS[(index + 1) % CORNERS.length]
            return [
                {
                    from: { x: center.x + from.x, y: center.y + from.y },
                    to: { x: center.x + to.x, y: center.y + to.y }
                }
            ]
        })
    })
}

// Houses stand on terraces around the founding temple, so they line up across tiles and stay put as the city grows.
function terraceHouses(anchor: Point, tiles: Point[], edges: CityEdge[]): CityHouse[] {
    const reach = Math.max(...tiles.map((tile) => distance(anchor, tile))) + HEX.yRadius
    const houses: CityHouse[] = []
    for (let terrace = 0; FIRST_TERRACE + terrace * TERRACE_SPACING < reach; terrace++) {
        const radius = FIRST_TERRACE + terrace * TERRACE_SPACING
        const circumference = 2 * Math.PI * radius
        let along = unitHash(terrace, 99) * 9
        for (let slot = 0; along < circumference; slot++) {
            const length = HOUSE_LENGTH.min + unitHash(terrace, slot, 7) * HOUSE_LENGTH.spread
            const angle = (along + length / 2) / radius + terrace * TERRACE_TWIST
            const offset = radius + (unitHash(terrace, slot, 10) - 0.5) * RADIAL_JITTER
            const center = {
                x: anchor.x + offset * Math.cos(angle),
                y: anchor.y + offset * Math.sin(angle) * TERRACE_SQUASH
            }
            const standing = unitHash(terrace, slot, 11) > MISSING_HOUSE_CHANCE
            if (standing && isBuildable(center, anchor, tiles, edges)) {
                houses.push({
                    center,
                    length,
                    depth: HOUSE_DEPTH.min + unitHash(terrace, slot, 8) * HOUSE_DEPTH.spread,
                    rotation:
                        (angle * 180) / Math.PI +
                        90 +
                        (unitHash(terrace, slot, 12) - 0.5) * ROTATION_JITTER
                })
            }
            along += length + (unitHash(terrace, slot, 9) < LANE.chance ? LANE.gap : HOUSE_GAP)
        }
    }
    return houses
}

function isBuildable(point: Point, anchor: Point, tiles: Point[], edges: CityEdge[]): boolean {
    const clearOfTemple =
        Math.abs(point.x - anchor.x) >= TEMPLE_CLEARANCE.x ||
        Math.abs(point.y - anchor.y) >= TEMPLE_CLEARANCE.y
    return (
        clearOfTemple &&
        tiles.some((tile) => insideHex(point, tile)) &&
        edges.every((edge) => distanceToEdge(point, edge) > EDGE_CLEARANCE)
    )
}

function insideHex(point: Point, center: Point): boolean {
    const dx = Math.abs(point.x - center.x)
    const dy = Math.abs(point.y - center.y)
    return dx <= HEX.xRadius && dy <= HEX.yRadius - (dx * HEX.yRadius) / (2 * HEX.xRadius)
}

function distanceToEdge(point: Point, { from, to }: CityEdge): number {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const along = ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy)
    const t = Math.max(0, Math.min(1, along))
    return Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy)
}

function distance(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y)
}

function unitHash(...values: number[]): number {
    let hash = 2166136261
    for (const value of values) {
        hash = Math.imul(hash ^ (value & 0xffff), 16777619)
        hash = Math.imul(hash ^ (value >>> 16), 16777619)
    }
    hash = Math.imul(hash ^ (hash >>> 13), 0x5bd1e995)
    hash ^= hash >>> 15
    return (hash >>> 0) / 4294967296
}
