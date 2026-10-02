import { getPrng, type Point, type RandomFunction } from '@tabletop/common'
import { mixColors } from '$lib/utils/colorLightness.js'

export type Cobble = { path: string; fill: string }

export const CobbleTileSize = 240
export const CobbleMortar = '#cdb791'
export const CobblePatternId = 'marracash-cobbles'
export const CobbleBevelFilterId = 'marracash-cobble-bevel'
export const CobbleGrainFilterId = 'marracash-cobble-grain'

const CobbleSeed = 11
const StoneCount = 157
const RelaxPasses = 2
const NeighbourCount = 60
const MortarGap = 1
const StoneColor = '#e5d3ad'
const StoneShadow = '#5a4630'
const ToneSpread = 0.05
const TileOffsets = [-CobbleTileSize, 0, CobbleTileSize]

function distanceSquared(a: Point, b: Point): number {
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}

function clipToHalfPlane(polygon: Point[], normal: Point, limit: number): Point[] {
    const inside = (point: Point) => normal.x * point.x + normal.y * point.y <= limit
    return polygon.flatMap((point, index) => {
        const next = polygon[(index + 1) % polygon.length]
        const kept = inside(point) ? [point] : []
        if (inside(point) === inside(next)) return kept
        const along =
            (limit - normal.x * point.x - normal.y * point.y) /
            (normal.x * (next.x - point.x) + normal.y * (next.y - point.y))
        return [
            ...kept,
            { x: point.x + along * (next.x - point.x), y: point.y + along * (next.y - point.y) }
        ]
    })
}

function tiledCopies(points: Point[]): Point[] {
    return points.flatMap((point) =>
        TileOffsets.flatMap((dx) => TileOffsets.map((dy) => ({ x: point.x + dx, y: point.y + dy })))
    )
}

function voronoiCell(site: Point, sites: Point[]): Point[] {
    const reach = (4 * CobbleTileSize) / Math.sqrt(StoneCount)
    const neighbours = sites
        .filter((other) => other.x !== site.x || other.y !== site.y)
        .sort((a, b) => distanceSquared(site, a) - distanceSquared(site, b))
        .slice(0, NeighbourCount)
    return neighbours.reduce(
        (cell, other) =>
            clipToHalfPlane(
                cell,
                { x: other.x - site.x, y: other.y - site.y },
                (other.x ** 2 + other.y ** 2 - site.x ** 2 - site.y ** 2) / 2
            ),
        [
            { x: site.x - reach, y: site.y - reach },
            { x: site.x + reach, y: site.y - reach },
            { x: site.x + reach, y: site.y + reach },
            { x: site.x - reach, y: site.y + reach }
        ]
    )
}

function centroid(polygon: Point[]): Point {
    return {
        x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
        y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length
    }
}

function wrapIntoTile(point: Point): Point {
    const wrap = (value: number) => ((value % CobbleTileSize) + CobbleTileSize) % CobbleTileSize
    return { x: wrap(point.x), y: wrap(point.y) }
}

function relaxedCells(prng: RandomFunction): Point[][] {
    let sites: Point[] = Array.from({ length: StoneCount }, () => ({
        x: prng() * CobbleTileSize,
        y: prng() * CobbleTileSize
    }))
    for (let pass = 0; ; pass++) {
        const allSites = tiledCopies(sites)
        const cells = sites.map((site) => voronoiCell(site, allSites))
        if (pass === RelaxPasses) return cells
        sites = cells.map((cell) => wrapIntoTile(centroid(cell)))
    }
}

function insetForMortar(cell: Point[]): Point[] {
    const center = centroid(cell)
    const radius =
        cell.reduce((sum, point) => sum + Math.sqrt(distanceSquared(point, center)), 0) /
        cell.length
    const scale = Math.max(0.5, 1 - MortarGap / radius)
    return cell.map((point) => ({
        x: center.x + (point.x - center.x) * scale,
        y: center.y + (point.y - center.y) * scale
    }))
}

function stoneFill(tone: number): string {
    return mixColors(StoneColor, tone > 0 ? '#ffffff' : StoneShadow, Math.abs(tone) * ToneSpread)
}

function touchesTile(stone: Point[]): boolean {
    return (
        stone.some((point) => point.x >= -1 && point.y >= -1) &&
        stone.some((point) => point.x <= CobbleTileSize + 1 && point.y <= CobbleTileSize + 1)
    )
}

function toPath(stone: Point[]): string {
    return `M ${stone.map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L ')} Z`
}

function layCobbles(): Cobble[] {
    const prng = getPrng(CobbleSeed)
    return relaxedCells(prng).flatMap((cell) => {
        const stone = insetForMortar(cell)
        const fill = stoneFill(prng() * 2 - 1)
        return TileOffsets.flatMap((dx) =>
            TileOffsets.map((dy) => stone.map((point) => ({ x: point.x + dx, y: point.y + dy })))
        )
            .filter(touchesTile)
            .map((copy) => ({ path: toPath(copy), fill }))
    })
}

export const Cobbles: readonly Cobble[] = layCobbles()
