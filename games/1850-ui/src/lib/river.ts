import { PointMath, TileRadius, smoothLinePath, type PrintedLine } from '@tabletop/18xx-ui'
import { Map1850, MesabiLocationId } from '@tabletop/1850'
import { calculateHexGeometry, type Point } from '@tabletop/common'

// Only the Mississippi counts under the rules (west of it, §15.2), so it stands out from the Missouri.
const MississippiColor = '#2f78c0'
const MississippiWidth = 5
const MissouriColor = '#8dbbe0'
const MissouriWidth = 3

type GridPoint = readonly [column: number, row: number]

// Traced from the published map, in map columns and rows. Stops sit mid-hex here and off-centre on
// the print, so the line keeps to the print's side of each but stays clear of it. St. Louis is laid
// out as printed, so the Mississippi rounds it to the east and the Missouri joins north of it.
const Mississippi: readonly GridPoint[] = [
    [6.6, 0.85],
    [6.75, 1.12],
    [7.15, 1.4],
    [7.62, 1.6],
    [7.9, 1.9],
    [8.15, 2.4],
    [8.3, 2.75],
    [8.3, 3.2],
    [8.9, 3.5],
    [9.7, 3.62],
    [10.6, 3.95],
    [11.1, 4.1],
    [11.6, 4.33],
    [12.0, 4.58],
    [12.3, 5.0],
    [12.3, 5.5],
    [12.4, 5.9],
    [12.9, 6.4],
    [13.55, 6.85],
    [13.6, 7.15],
    [13.1, 7.52],
    [12.6, 7.6],
    [11.9, 7.62],
    [11.4, 7.9],
    [11.35, 8.35],
    [11.7, 8.7],
    [11.7, 9.05],
    [11.4, 9.6],
    [11.8, 10.2],
    [12.31, 10.6],
    [12.4, 10.79],
    [12.68, 10.77],
    [13.0, 10.84],
    [13.16, 11.05],
    [13.02, 11.25],
    [12.86, 11.41],
    [12.72, 11.57],
    [12.75, 11.9],
    [12.8, 12.15],
    [12.75, 12.33]
]

const Missouri: readonly GridPoint[] = [
    [2.1, 5.3],
    [2.6, 5.33],
    [3.1, 5.4],
    [3.4, 5.55],
    [3.3, 6.0],
    [3.6, 6.45],
    [4.4, 6.6],
    [4.6, 7.0],
    [4.7, 7.4],
    [4.75, 7.7],
    [4.75, 8.2],
    [4.7, 8.7],
    [4.6, 9.1],
    [4.85, 9.5],
    [5.3, 9.75],
    [5.4, 10.2],
    [5.9, 10.42],
    [6.6, 10.36],
    [7.0, 10.24],
    [7.4, 10.32],
    [7.9, 10.42],
    [8.4, 10.45],
    [8.65, 10.7],
    [9.05, 10.85],
    [9.6, 10.88],
    [10.0, 10.92],
    [10.6, 11.1],
    [11.5, 11.2],
    [11.85, 11.08],
    [12.0, 10.96],
    [12.21, 10.85],
    [12.38, 10.8]
]

// Where a hex's cost keeps clear of the rivers and its stops.
export const RiverTerrainPositions: Readonly<Record<string, Point>> = {
    B7: { x: 0, y: -28 },
    C8: { x: 20, y: 0 },
    D9: { x: 6, y: 27 },
    G4: { x: 6, y: 26 },
    G12: { x: -18, y: 0 },
    H13: { x: -18, y: 0 },
    I18: { x: -24, y: 22 },
    J11: { x: -6, y: 27 },
    K6: { x: 0, y: -30 },
    K8: { x: 0, y: -28 },
    K12: { x: 12, y: 0 },
    L9: { x: 0, y: 10 },
    L11: { x: 0, y: -10 },
    L13: { x: 23, y: 12 }
}

const worldPoint = ([column, row]: GridPoint): Point => ({
    x: (column * Math.sqrt(3) * TileRadius) / 2,
    y: row * 1.5 * TileRadius
})

const LocationCenters = Map1850.definition.locations
    .filter((location) => location.id !== MesabiLocationId)
    .map((location) => ({
        id: location.id,
        center: calculateHexGeometry(
            { orientation: Map1850.definition.orientation, dimensions: { radius: TileRadius } },
            location.coordinates
        ).center
    }))

function nearestHex(point: Point) {
    return LocationCenters.reduce((best, candidate) =>
        Math.hypot(candidate.center.x - point.x, candidate.center.y - point.y) <
        Math.hypot(best.center.x - point.x, best.center.y - point.y)
            ? candidate
            : best
    )
}

const direction = (from: Point, to: Point) => PointMath.unit(PointMath.minus(to, from))

/**
 * Follows a traced line along its curve, and splits it where it crosses from one hex to the next, so
 * that no hex draws over its neighbour: the map leaves a hex's line off once a tile covers it.
 */
function legs(trace: readonly GridPoint[]) {
    const points = trace.map(worldPoint)
    const { samples } = smoothLinePath(
        points,
        direction(points[0], points[1]),
        direction(points[points.length - 2], points[points.length - 1])
    )
    const hexLegs: { locationId: string; center: Point; points: Point[] }[] = []
    for (const [index, point] of samples.entries()) {
        const { id, center } = nearestHex(point)
        const current = hexLegs.at(-1)
        if (current?.locationId === id) {
            current.points.push(point)
            continue
        }
        const previous = samples[index - 1]
        const join = previous && PointMath.scale(PointMath.add(previous, point), 0.5)
        if (current && join) current.points.push(join)
        hexLegs.push({ locationId: id, center, points: [...(join ? [join] : []), point] })
    }
    return hexLegs.filter((leg) => leg.points.length >= 2)
}

function printedLines(trace: readonly GridPoint[], color: string, width: number) {
    return legs(trace).map(({ locationId, center, points }): [string, PrintedLine] => {
        const local = points.map((point) => PointMath.minus(point, center))
        const d = local
            .map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`)
            .join(' ')
        return [locationId, { d, points: local, color, width }]
    })
}

export function riverLines(): Readonly<Record<string, readonly PrintedLine[]>> {
    const lines: Record<string, PrintedLine[]> = {}
    for (const [locationId, line] of [
        ...printedLines(Missouri, MissouriColor, MissouriWidth),
        ...printedLines(Mississippi, MississippiColor, MississippiWidth)
    ])
        (lines[locationId] ??= []).push(line)
    return lines
}
