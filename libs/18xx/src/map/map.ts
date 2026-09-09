import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Clone } from 'typebox/value'
import {
    assert,
    assertExists,
    AxialCoordinates,
    createCoordinatedNode,
    deepFreeze,
    HexGrid,
    HexOrientation,
    type HexGridNode
} from '@tabletop/common'
import { TileEdge, TileFace, type ImmutableTileData } from '../tiles/tile.js'
import { assertTileTopology } from '../tiles/validation.js'
import { tileEdgeDirection } from '../tiles/topology.js'

const Identifier = Type.String({ minLength: 1 })

export const MapLocation = Type.Object(
    {
        id: Identifier,
        coordinates: AxialCoordinates,
        name: Type.Optional(Identifier),
        preprintedTile: TileFace,
        buildable: Type.Boolean(),
        terrain: Type.Optional(
            Type.Object(
                {
                    cost: Type.Integer({ minimum: 0 }),
                    kinds: Type.Array(Identifier, { uniqueItems: true })
                },
                { additionalProperties: false }
            )
        ),
        borders: Type.Optional(
            Type.Array(
                Type.Object(
                    {
                        edge: TileEdge,
                        kind: Type.Union([
                            Type.Literal('impassable'),
                            Type.Literal('water'),
                            Type.Literal('mountain')
                        ]),
                        cost: Type.Optional(Type.Integer({ minimum: 0 }))
                    },
                    { additionalProperties: false }
                )
            )
        ),
        reservations: Type.Optional(
            Type.Array(
                Type.Object(
                    {
                        companyId: Identifier,
                        nodeId: Identifier
                    },
                    { additionalProperties: false }
                )
            )
        ),
        upgradeLabels: Type.Optional(
            Type.Array(
                Type.Object(
                    {
                        color: Identifier,
                        label: Identifier
                    },
                    { additionalProperties: false }
                )
            )
        ),
        markers: Type.Optional(
            Type.Array(
                Type.Object(
                    {
                        id: Identifier,
                        label: Identifier,
                        description: Identifier
                    },
                    { additionalProperties: false }
                )
            )
        )
    },
    { additionalProperties: false }
)
export type MapLocation = ImmutableTileData<Type.Static<typeof MapLocation>>

export const RailwayMapDefinition = Type.Object(
    {
        id: Identifier,
        name: Identifier,
        orientation: Type.Enum(HexOrientation),
        locations: Type.Array(MapLocation, { minItems: 1 })
    },
    { additionalProperties: false }
)
export type RailwayMapDefinition = ImmutableTileData<Type.Static<typeof RailwayMapDefinition>>
const MapValidator = Compile(RailwayMapDefinition)

export class RailwayMap {
    readonly definition: RailwayMapDefinition
    readonly preprintedTiles: Readonly<Record<string, TileFace>>
    private readonly locationsById: Map<string, MapLocation>
    private readonly grid: HexGrid<HexGridNode & { locationId: string }>

    constructor(value: RailwayMapDefinition) {
        assert(MapValidator.Check(value), 'Invalid railway map schema')
        this.definition = Clone(value)
        deepFreeze(this.definition)
        this.locationsById = new Map()
        this.grid = new HexGrid({ hexDefinition: { orientation: value.orientation } })
        for (const location of this.definition.locations) {
            assert(!this.locationsById.has(location.id), `Duplicate map location: ${location.id}`)
            assert(
                Number.isInteger(location.coordinates.q) &&
                    Number.isInteger(location.coordinates.r),
                'Map coordinates must be integral'
            )
            assert(
                !this.grid.nodeAt(location.coordinates),
                `Duplicate map coordinates: ${location.id}`
            )
            assertTileTopology(location.preprintedTile)
            for (const reservation of location.reservations ?? []) {
                assert(
                    location.preprintedTile.nodes.some(
                        (node) => node.id === reservation.nodeId && node.kind === 'city'
                    ),
                    'Reservation requires a city'
                )
            }
            const markerIds = (location.markers ?? []).map((marker) => marker.id)
            assert(new Set(markerIds).size === markerIds.length, 'Duplicate map marker')
            const edges = (location.borders ?? []).map((border) => border.edge)
            assert(new Set(edges).size === edges.length, 'Duplicate map border')
            this.locationsById.set(location.id, location)
            this.grid.setNode({
                ...createCoordinatedNode(location.coordinates),
                locationId: location.id
            })
        }
        this.preprintedTiles = Object.freeze(
            Object.fromEntries(
                this.definition.locations.map((location) => [location.id, location.preprintedTile])
            )
        )
    }

    location(id: string): MapLocation {
        const location = this.locationsById.get(id)
        assertExists(location, `Unknown map location: ${id}`)
        return location
    }

    neighbor(id: string, edge: TileEdge): MapLocation | undefined {
        const node = this.grid.neighborAt(
            this.location(id).coordinates,
            tileEdgeDirection(edge, this.definition.orientation)
        )
        return node ? this.locationsById.get(node.locationId) : undefined
    }
}

export function letterNumberHexCoordinates(
    id: string,
    orientation: HexOrientation,
    numberOffset: number
): AxialCoordinates {
    const match = /^([A-Z]+)(\d+)$/.exec(id)
    assertExists(match, `Invalid letter-number coordinate: ${id}`)
    const letter =
        [...match[1]].reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0) - 1
    const other = (Number(match[2]) - numberOffset - letter) / 2
    assert(Number.isInteger(other), `Invalid coordinate parity: ${id}`)
    return orientation === HexOrientation.Flat ? { q: letter, r: other } : { q: other, r: letter }
}

export function createLetterNumberLocationFactory(options: {
    orientation: HexOrientation
    numberOffset: number
    fixedColors: readonly string[]
    names: Readonly<Record<string, string>>
    homes: Readonly<Record<string, string>>
    markers: Readonly<Record<string, NonNullable<MapLocation['markers']>>>
}) {
    return (
        ids: string,
        preprintedTile: TileFace,
        details: Partial<Pick<MapLocation, 'terrain' | 'upgradeLabels'>> = {}
    ): MapLocation[] =>
        ids.split(' ').map((id) => ({
            id,
            coordinates: letterNumberHexCoordinates(id, options.orientation, options.numberOffset),
            preprintedTile,
            buildable: !options.fixedColors.includes(preprintedTile.color),
            ...details,
            ...(options.names[id] ? { name: options.names[id] } : {}),
            ...(options.homes[id]
                ? { reservations: [{ companyId: options.homes[id], nodeId: 'city' }] }
                : {}),
            ...(options.markers[id] ? { markers: options.markers[id] } : {})
        }))
}
