import type { TileEdge, TileEndpoint, TileFace, TilePath, TileRevenue } from '@tabletop/18xx'

/** The node of a hex's one city, as the family's city faces name it. */
export const CityNodeId = 'city'

export const LondonLabel = 'L'
export const EnglishChannelLabel = 'EC'

/**
 * London's six stations by the side of the hex each one's track leaves by, sides 0 to 5 (§1.2.3).
 */
export const LondonNodeIds = ['s', 'sw', 'nw', 'n', 'ne', 'se'] as const
export type LondonNodeId = (typeof LondonNodeIds)[number]
const LondonEdges: readonly TileEdge[] = [0, 1, 2, 3, 4, 5]

/** What each London upgrade costs (§5.10.1). */
export const LondonUpgradeCost1822 = 20
/** What each upgrade of the English Channel costs (§5.9.1). */
export const EnglishChannelUpgradeCost1822 = 100

/**
 * London at one stage of its development: six separate stations of one space, each with track to
 * its own side of the hex and none between them (§1.2.3, §5.10.1, §5.10.2).
 */
export function londonFace(color: string, revenue: number, upgradeCost?: number): TileFace {
    return {
        color,
        nodes: LondonNodeIds.map((id) => ({
            id,
            kind: 'city',
            stationSlots: 1,
            revenue: { kind: 'fixed', amount: revenue }
        })),
        paths: LondonEdges.map((edge) => ({
            id: `edge-${edge}`,
            endpoints: [
                { kind: 'edge', edge },
                { kind: 'node', nodeId: LondonNodeIds[edge] }
            ]
        })),
        labels: [LondonLabel],
        ...(upgradeCost === undefined ? {} : { upgradeCost })
    }
}

/** A track end at a hex side: its first track, or a further parallel one. */
export function sideEnd(edge: TileEdge, lane = 0): TileEndpoint {
    return lane ? { kind: 'edge', edge, lane } : { kind: 'edge', edge }
}

/**
 * The English Channel at one stage: a station of no value that counts as one stop with France,
 * with track to the listed sides (§5.4.6, §5.13.7). Each exit is a side, or a side with the number
 * of parallel tracks across it.
 */
export function englishChannelFace(
    color: string,
    stationSlots: number,
    exits: readonly (TileEdge | readonly [edge: TileEdge, lanes: number])[],
    upgradeCost?: number
): TileFace {
    return {
        color,
        nodes: [
            {
                id: CityNodeId,
                kind: 'city',
                stationSlots,
                revenue: { kind: 'fixed', amount: 0 },
                uncounted: true
            }
        ],
        paths: exits.flatMap((exit) => {
            const [edge, lanes] = typeof exit === 'number' ? [exit, 1] : exit
            return Array.from({ length: lanes }, (_, lane): TilePath => ({
                id: lane ? `edge-${edge}-lane-${lane}` : `edge-${edge}`,
                endpoints: [sideEnd(edge, lane), { kind: 'node', nodeId: CityNodeId }]
            }))
        }),
        labels: [EnglishChannelLabel],
        ...(upgradeCost === undefined ? {} : { upgradeCost })
    }
}

/** The four values a grey area prints, for yellow, green, brown and grey phases (§5.4.5). */
export function phasedRevenue(
    yellow: number,
    green: number,
    brown: number,
    grey: number
): TileRevenue {
    return {
        kind: 'staged',
        values: [
            { stage: 'yellow', amount: yellow },
            { stage: 'green', amount: green },
            { stage: 'brown', amount: brown },
            { stage: 'gray', amount: grey }
        ]
    }
}
