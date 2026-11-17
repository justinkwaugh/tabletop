import * as Type from 'typebox'
import { assert, assertExists, HexOrientation, type AxialCoordinates } from '@tabletop/common'
import type { BonusId } from './bonuses.js'
import {
    axialToHexId,
    compareReadingOrder,
    hexIdToAxial,
    neighbourCellIds,
    type HexId
} from './hexes.js'
import { MAP_KEYS, type MapId, type MapKey } from './maps.js'
import type { RailroadId } from './railroads.js'

export const CityId = Type.TemplateLiteral([
    Type.Literal('city.'),
    Type.Enum(MAP_KEYS),
    Type.Literal('.'),
    Type.String()
])
export type CityId = Type.Static<typeof CityId>

// A bonus a city prints; the line and connection bonuses belong to no one city.
export type CityBonusId = Exclude<
    BonusId,
    'bonus.usa.transcontinental' | 'bonus.ca.intercolonial' | 'bonus.de.greater-germany'
>

// R-4.1.4: how many railroads a city holds.
export type CityCapacity = 1 | 2 | 'unlimited'

// R-4.1.4, R-8: an Alps hex holds none.
export type HexCapacity = 0 | CityCapacity

// The printed groups a map's rules name: the coasts of the USA (R-4.1.4, R-4.2, R-4.3.3); France's
// Red/Blue/Black cities and the entry hexes round Paris (R-8.4).
export type HexGroup = 'east-coast' | 'west-coast' | 'red-blue-black' | 'paris-entry'

export type City = {
    id: CityId
    name: string
    hexId: HexId
    startColours: readonly RailroadId[]
    capacity: CityCapacity
    bonus: CityBonusId | null
    groups: readonly HexGroup[]
}

// R-8: the Alps and the long-distance hexes are the expansion maps'.
export type Terrain = 'plain' | 'mountain' | 'alps' | 'long-distance' | 'city'

type HexBase = {
    id: HexId
    // R-8: a hex drawn over two cells (Berlin) names the cells past the one its id gives.
    extraCells?: readonly AxialCoordinates[]
}

export type TerrainHex = HexBase & {
    terrain: Exclude<Terrain, 'city'>
    groups?: readonly HexGroup[]
}

export type CityHex = HexBase & { terrain: 'city'; cityId: CityId }

export type Hex = TerrainHex | CityHex

// Two hexes a printed impassable side parts: not adjacent for building, links or bonuses (R-8).
// A side printed along the board's edge lies between a hex and a cell off the board, and parts
// nothing.
export type ImpassablePair = readonly [HexId, HexId]

// One map as printed. The rules read it through `BoardMap`; per-map rule tables sit beside the
// rules they belong to, keyed by `MapId`.
export type MapDefinition = {
    readonly id: MapId
    readonly key: MapKey
    readonly orientation: HexOrientation
    readonly hexes: readonly Hex[]
    readonly cities: readonly City[]
    readonly impassable: readonly ImpassablePair[]
    // R-1.3.2: every city takes a passenger at setup but these.
    readonly citiesWithoutSetupPassenger: readonly CityId[]
    // R-8.2: the cities that close a long-distance chain (Perth and Brisbane). A placement there
    // follows a long-distance hex's rule, and no railroad starts there.
    readonly longDistanceCities: readonly CityId[]
}

const NON_CITY_CAPACITY = 2
const LONG_DISTANCE_CAPACITY = 1
const PARIS_ENTRY_CAPACITY = 1
const ALPS_CAPACITY = 0

export class BoardMap {
    readonly id: MapId
    readonly key: MapKey
    readonly orientation: HexOrientation
    // In reading order (`compareReadingOrder`).
    readonly hexes: readonly Hex[]
    // In the map table's order.
    readonly cities: readonly City[]
    readonly citiesWithoutSetupPassenger: readonly CityId[]
    readonly longDistanceCities: readonly CityId[]
    // R-8: the printed impassable sides, as the map lists them, for the board to draw.
    readonly impassable: readonly ImpassablePair[]

    private readonly hexesById: ReadonlyMap<string, Hex>
    private readonly citiesById: ReadonlyMap<string, City>
    private readonly order: ReadonlyMap<HexId, number>
    private readonly adjacency: ReadonlyMap<HexId, readonly HexId[]>

    constructor(definition: MapDefinition) {
        this.id = definition.id
        this.key = definition.key
        this.orientation = definition.orientation
        this.hexes = [...definition.hexes].sort((a, b) =>
            compareReadingOrder(definition.orientation, a.id, b.id)
        )
        this.cities = definition.cities
        this.citiesWithoutSetupPassenger = definition.citiesWithoutSetupPassenger
        this.longDistanceCities = definition.longDistanceCities
        this.impassable = definition.impassable
        this.hexesById = new Map(this.hexes.map((hex) => [hex.id, hex]))
        this.citiesById = new Map(this.cities.map((city) => [city.id, city]))
        this.order = new Map(this.hexes.map((hex, index) => [hex.id, index]))
        this.assertConsistent(definition)
        this.adjacency = this.adjacencyOf(definition.impassable)
    }

    hasHex(hexId: string): hexId is HexId {
        return this.hexesById.has(hexId)
    }

    hasCity(cityId: string): cityId is CityId {
        return this.citiesById.has(cityId)
    }

    hex(hexId: HexId): Hex {
        const hex = this.hexesById.get(hexId)
        assertExists(hex, `No hex ${hexId} on ${this.id}`)
        return hex
    }

    city(cityId: CityId): City {
        const city = this.citiesById.get(cityId)
        assertExists(city, `No city ${cityId} on ${this.id}`)
        return city
    }

    cityIn(hexId: HexId): City | undefined {
        const hex = this.hex(hexId)
        return hex.terrain === 'city' ? this.city(hex.cityId) : undefined
    }

    // Every cell a hex covers, its id's cell first.
    cellsOf(hexId: HexId): AxialCoordinates[] {
        return [hexIdToAxial(this.orientation, hexId), ...(this.hex(hexId).extraCells ?? [])]
    }

    // The hex's place in reading order.
    hexOrder(hexId: HexId): number {
        const order = this.order.get(hexId)
        assertExists(order, `No hex ${hexId} on ${this.id}`)
        return order
    }

    // R-4.1.2, R-8: the hexes sharing a side with any of this hex's cells, less those an
    // impassable side parts from it.
    adjacentHexIds(hexId: HexId): readonly HexId[] {
        const adjacent = this.adjacency.get(hexId)
        assertExists(adjacent, `No hex ${hexId} on ${this.id}`)
        return adjacent
    }

    // R-4.1.4, R-8: a city's printed capacity; an Alps hex none, a long-distance hex or a Paris entry
    // hex one, else two.
    capacity(hexId: HexId): HexCapacity {
        const hex = this.hex(hexId)
        switch (hex.terrain) {
            case 'city':
                return this.city(hex.cityId).capacity
            case 'alps':
                return ALPS_CAPACITY
            case 'long-distance':
                return LONG_DISTANCE_CAPACITY
            case 'plain':
            case 'mountain':
                return (hex.groups ?? []).includes('paris-entry')
                    ? PARIS_ENTRY_CAPACITY
                    : NON_CITY_CAPACITY
        }
    }

    // R-8.2: a long-distance hex, or a long-distance city's: a placement there must be the turn's
    // first, and it ends the turn.
    isLongDistance(hexId: HexId): boolean {
        const hex = this.hex(hexId)
        return hex.terrain === 'city'
            ? this.longDistanceCities.includes(hex.cityId)
            : hex.terrain === 'long-distance'
    }

    // R-1.3.2, R-8: the cities that take a passenger at setup, in the map table's order.
    setupPassengerCityIds(): CityId[] {
        return this.cities
            .map((city) => city.id)
            .filter((cityId) => !this.citiesWithoutSetupPassenger.includes(cityId))
    }

    groupsOf(hexId: HexId): readonly HexGroup[] {
        const hex = this.hex(hexId)
        return hex.terrain === 'city' ? this.city(hex.cityId).groups : (hex.groups ?? [])
    }

    private assertConsistent(definition: MapDefinition) {
        assert(this.hexesById.size === definition.hexes.length, `${this.id} repeats a hex id`)
        assert(this.citiesById.size === definition.cities.length, `${this.id} repeats a city id`)
        for (const city of definition.cities) {
            const hex = this.hexesById.get(city.hexId)
            assert(
                hex?.terrain === 'city' && hex.cityId === city.id,
                `${city.id} is not in a city hex of ${this.id}`
            )
        }
        for (const hex of definition.hexes) {
            assert(hex.id.startsWith(`hex.${definition.key}.`), `${hex.id} is not ${this.id}'s`)
            assert(
                hex.terrain !== 'city' || this.citiesById.has(hex.cityId),
                `${hex.id} names a city ${this.id} does not have`
            )
        }
        for (const cityId of [
            ...definition.citiesWithoutSetupPassenger,
            ...definition.longDistanceCities
        ]) {
            assert(this.citiesById.has(cityId), `${cityId} is not on ${this.id}`)
        }
    }

    private adjacencyOf(impassable: readonly ImpassablePair[]): Map<HexId, readonly HexId[]> {
        const owners = new Map<HexId, HexId>()
        for (const hex of this.hexes) {
            for (const cell of this.cellsOf(hex.id)) {
                const cellId = axialToHexId(this.orientation, this.key, cell)
                assert(!owners.has(cellId), `Two hexes of ${this.id} cover ${cellId}`)
                owners.set(cellId, hex.id)
            }
        }
        const touching = (hexId: HexId) => {
            const found = new Set<HexId>()
            for (const cell of this.cellsOf(hexId)) {
                for (const cellId of neighbourCellIds(this.orientation, this.key, cell)) {
                    const owner = owners.get(cellId)
                    if (owner !== undefined && owner !== hexId) {
                        found.add(owner)
                    }
                }
            }
            return [...found]
        }
        // Whether the hex shares a side with a cell off the board, one no hex covers.
        const touchesOffBoard = (hexId: HexId, cellId: HexId) =>
            !owners.has(cellId) &&
            this.cellsOf(hexId).some((cell) =>
                neighbourCellIds(this.orientation, this.key, cell).includes(cellId)
            )
        const parted = new Set<string>()
        for (const [a, b] of impassable) {
            assert(
                this.hexesById.has(a) || this.hexesById.has(b),
                `${a} and ${b} are both off ${this.id}`
            )
            const [hexId, other] = this.hexesById.has(a) ? [a, b] : [b, a]
            assert(
                this.hexesById.has(other)
                    ? touching(hexId).includes(other)
                    : touchesOffBoard(hexId, other),
                `${a} and ${b} share no side on ${this.id}`
            )
            parted.add(`${a}|${b}`).add(`${b}|${a}`)
        }
        return new Map(
            this.hexes.map((hex) => [
                hex.id,
                touching(hex.id).filter((other) => !parted.has(`${hex.id}|${other}`))
            ])
        )
    }
}
