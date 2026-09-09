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
    Type.Object({ kind: Type.Literal('edge'), edge: TileEdge }, { additionalProperties: false }),
    Type.Object({ kind: Type.Literal('node'), nodeId: Identifier }, { additionalProperties: false })
])
export type TileEndpoint = ImmutableTileData<Type.Static<typeof TileEndpoint>>

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

export const TileNode = Type.Union([
    Type.Object(
        {
            id: Identifier,
            kind: Type.Literal('city'),
            revenue: TileRevenue,
            stationSlots: Type.Integer({ minimum: 0 })
        },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            id: Identifier,
            kind: Type.Union([Type.Literal('town'), Type.Literal('offboard')]),
            revenue: TileRevenue
        },
        { additionalProperties: false }
    ),
    Type.Object({ id: Identifier, kind: Type.Literal('junction') }, { additionalProperties: false })
])
export type TileNode = ImmutableTileData<Type.Static<typeof TileNode>>

export const TilePath = Type.Object(
    { id: Identifier, endpoints: Type.Tuple([TileEndpoint, TileEndpoint]) },
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
