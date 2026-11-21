import * as Type from 'typebox'

export type ImmutableTileData<T> = { readonly [K in keyof T]: ImmutableTileData<T[K]> }

const Identifier = Type.String({ minLength: 1 })

export const TileEdge = Type.Union([
    Type.Literal(0),
    Type.Literal(1),
    Type.Literal(2),
    Type.Literal(3),
    Type.Literal(4),
    Type.Literal(5)
])
export type TileEdge = Type.Static<typeof TileEdge>

export const TileRotation = TileEdge
export type TileRotation = Type.Static<typeof TileRotation>

export const TileEndpoint = Type.Union([
    Type.Object(
        {
            kind: Type.Literal('edge'),
            edge: TileEdge,
            /**
             * Which of several parallel tracks crossing the hex side this is, beyond the first:
             * each lane meets the same lane across the side and is track of its own, so two
             * trains may cross the side on different lanes.
             */
            lane: Type.Optional(Type.Integer({ minimum: 1 }))
        },
        { additionalProperties: false }
    ),
    Type.Object({ kind: Type.Literal('node'), nodeId: Identifier }, { additionalProperties: false })
])
export type TileEndpoint = ImmutableTileData<Type.Static<typeof TileEndpoint>>
/** A track end at a hex side. */
export type TileEdgeEndpoint = Extract<TileEndpoint, { kind: 'edge' }>

export const TileRevenue = Type.Union([
    Type.Object(
        { kind: Type.Literal('fixed'), amount: Type.Integer({ minimum: 0 }) },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            kind: Type.Literal('staged'),
            values: Type.Array(
                Type.Object(
                    { stage: Identifier, amount: Type.Integer({ minimum: 0 }) },
                    { additionalProperties: false }
                ),
                { minItems: 1 }
            )
        },
        { additionalProperties: false }
    )
])
export type TileRevenue = ImmutableTileData<Type.Static<typeof TileRevenue>>

/**
 * The stop uses none of a train's distance, as a station that counts with the place beyond it:
 * 1822's English Channel station, which counts as one stop with France (§5.4.6).
 */
const Uncounted = Type.Optional(Type.Literal(true))

export const TileNode = Type.Union([
    Type.Object(
        {
            id: Identifier,
            kind: Type.Literal('city'),
            revenue: TileRevenue,
            stationSlots: Type.Integer({ minimum: 0 }),
            uncounted: Uncounted
        },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            id: Identifier,
            kind: Type.Literal('town'),
            revenue: TileRevenue,
            uncounted: Uncounted,
            /**
             * A halt: a stop that earns a run nothing, its visit paid to the company's treasury
             * as a subsidy instead, and where no run begins or ends, as 1860's halts.
             */
            halt: Type.Optional(Type.Literal(true))
        },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            id: Identifier,
            kind: Type.Literal('offboard'),
            revenue: TileRevenue,
            uncounted: Uncounted
        },
        { additionalProperties: false }
    ),
    Type.Object({ id: Identifier, kind: Type.Literal('junction') }, { additionalProperties: false })
])
export type TileNode = ImmutableTileData<Type.Static<typeof TileNode>>

/** Whether the node is a halt: a town whose visit pays the company a subsidy, not the run. */
export function isHalt(node: TileNode): boolean {
    return node.kind === 'town' && node.halt === true
}

/**
 * The gauge of a track path where a title has more than one: narrow track, or dual track that
 * carries either gauge. A path without a gauge is standard track.
 */
export const TrackGauge = Type.Union([Type.Literal('narrow'), Type.Literal('dual')])
export type TrackGauge = Type.Static<typeof TrackGauge>

export const TilePath = Type.Object(
    {
        id: Identifier,
        endpoints: Type.Tuple([TileEndpoint, TileEndpoint]),
        gauge: Type.Optional(TrackGauge),
        /**
         * A route that reaches the path's stop along it ends there: it may start from the stop
         * and leave along the path, but not arrive and run on, as at 1822's grey terminus
         * cities (§5.4.4). The path joins one stop to a hex side or junction.
         */
        terminus: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type TilePath = ImmutableTileData<Type.Static<typeof TilePath>>

export const TileFace = Type.Object(
    {
        color: Identifier,
        nodes: Type.Array(TileNode),
        paths: Type.Array(TilePath),
        labels: Type.Array(Identifier, { uniqueItems: true }),
        symbols: Type.Optional(Type.Array(Identifier, { uniqueItems: true })),
        upgradeCost: Type.Optional(Type.Integer({ minimum: 0 }))
    },
    { additionalProperties: false }
)
export type TileFace = ImmutableTileData<Type.Static<typeof TileFace>>

export const TileDefinition = Type.Object(
    {
        id: Identifier,
        printedNumber: Identifier,
        aliases: Type.Array(Identifier, { uniqueItems: true }),
        scope: Identifier,
        face: TileFace
    },
    { additionalProperties: false }
)
export type TileDefinition = ImmutableTileData<Type.Static<typeof TileDefinition>>
