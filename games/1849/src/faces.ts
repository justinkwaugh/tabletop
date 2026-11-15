import { assert } from '@tabletop/common'
import {
    createCityTileFace,
    createOffboardTileFace,
    createTownTileFace,
    createTrackTileFace,
    type TileEdge,
    type TileFace,
    type TilePath,
    type TileRevenue,
    type TrackGauge
} from '@tabletop/18xx'

/** A tile side with track: standard gauge, or the gauge printed for it (§10.3). */
export type Exit = TileEdge | readonly [edge: TileEdge, gauge: TrackGauge]
/** A track section between two sides, standard gauge unless one is given. */
export type Segment =
    readonly [a: TileEdge, b: TileEdge] | readonly [a: TileEdge, b: TileEdge, gauge: TrackGauge]

export const Narrow = 'narrow'
export const Dual = 'dual'

const edgeOf = (exit: Exit): TileEdge => (typeof exit === 'number' ? exit : exit[0])

function withGauge(path: TilePath, gauge: TrackGauge | undefined): TilePath {
    return gauge ? { ...path, gauge } : path
}

function gaugeExits(face: TileFace, exits: readonly Exit[]): TileFace {
    const gauges = new Map(exits.flatMap((exit) => (typeof exit === 'number' ? [] : [exit])))
    return {
        ...face,
        paths: face.paths.map((path) => {
            const edges = path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
            assert(edges.length === 1, 'A stop’s exit runs from one side')
            return withGauge(path, gauges.get(edges[0]))
        })
    }
}

export function cityFace(
    color: string,
    exits: readonly Exit[],
    revenue: number | TileRevenue,
    stationSlots: number,
    labels: readonly string[] = []
): TileFace {
    return gaugeExits(
        createCityTileFace(color, exits.map(edgeOf), revenue, stationSlots, labels),
        exits
    )
}

export function townFace(
    color: string,
    exits: readonly Exit[],
    revenue: number | TileRevenue
): TileFace {
    return gaugeExits(createTownTileFace(color, [exits.map(edgeOf)], revenue), exits)
}

export function offboardFace(
    color: string,
    exits: readonly Exit[],
    revenue: TileRevenue
): TileFace {
    return { ...gaugeExits(createOffboardTileFace(exits.map(edgeOf), revenue), exits), color }
}

export function trackFace(color: string, segments: readonly Segment[]): TileFace {
    const face = createTrackTileFace(
        color,
        segments.map(([a, b]) => [a, b])
    )
    return {
        ...face,
        paths: face.paths.map((path, index) => withGauge(path, segments[index][2]))
    }
}
