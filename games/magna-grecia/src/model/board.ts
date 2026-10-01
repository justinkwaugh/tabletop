import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AxialCoordinates,
    ClockwisePointyHexDirections,
    Hydratable,
    assertExists,
    sameCoordinates
} from '@tabletop/common'
import {
    BOARD_GRID,
    SpaceType,
    neighborCoords,
    oppositeDirection
} from '../components/boardGrid.js'
import { City, Market, Oracle, RoadTile } from '../components/pieces.js'
import {
    PlaceKind,
    cityPlaceId,
    oraclePlaceId,
    villagePlaceId,
    type Place,
    type PlaceId
} from '../components/places.js'
import { buildNetwork, type Network } from './network.js'

export const MARKETS_PER_PLAYER = 20

export type OracleChange = Type.Static<typeof OracleChange>
export const OracleChange = Type.Object({
    oracle: AxialCoordinates,
    fromCityId: Type.Optional(Type.String()),
    toCityId: Type.String()
})

export type Board = Type.Static<typeof Board>
export const Board = Type.Object({
    roads: Type.Array(RoadTile),
    cities: Type.Array(City),
    oracles: Type.Array(Oracle),
    markets: Type.Array(Market),
    nextCityNumber: Type.Number()
})

export const BoardValidator = Compile(Board)

export class HydratedBoard extends Hydratable<typeof Board> implements Board {
    declare roads: RoadTile[]
    declare cities: City[]
    declare oracles: Oracle[]
    declare markets: Market[]
    declare nextCityNumber: number

    constructor(data: Board) {
        super(data, BoardValidator)
    }

    cityAt(coords: AxialCoordinates): City | undefined {
        return this.cities.find((city) =>
            city.spaces.some((space) => sameCoordinates(space, coords))
        )
    }

    roadAt(coords: AxialCoordinates): RoadTile | undefined {
        return this.roads.find((road) => sameCoordinates(road.coords, coords))
    }

    oracleAt(coords: AxialCoordinates): Oracle | undefined {
        return this.oracles.find((oracle) => sameCoordinates(oracle.coords, coords))
    }

    city(cityId: string): City {
        const city = this.cities.find((candidate) => candidate.id === cityId)
        assertExists(city, `No city ${cityId}`)
        return city
    }

    isOpenVillage(coords: AxialCoordinates): boolean {
        return (
            BOARD_GRID.space(coords)?.type === SpaceType.Village &&
            !this.cityAt(coords) &&
            !this.oracleAt(coords)
        )
    }

    isEmptyPlain(coords: AxialCoordinates): boolean {
        return (
            BOARD_GRID.space(coords)?.type === SpaceType.Plain &&
            !this.cityAt(coords) &&
            !this.roadAt(coords)
        )
    }

    placeAt(coords: AxialCoordinates): Place | undefined {
        const city = this.cityAt(coords)
        if (city) {
            return this.cityPlace(city)
        }
        if (this.oracleAt(coords)) {
            return { id: oraclePlaceId(coords), kind: PlaceKind.Oracle, spaces: [coords] }
        }
        if (this.isOpenVillage(coords)) {
            return { id: villagePlaceId(coords), kind: PlaceKind.Village, spaces: [coords] }
        }
        return undefined
    }

    places(): Place[] {
        const villages = BOARD_GRID.villages()
            .filter((space) => this.isOpenVillage(space.coords))
            .map((space) => ({
                id: villagePlaceId(space.coords),
                kind: PlaceKind.Village,
                spaces: [space.coords]
            }))
        const oracles = this.oracles.map((oracle) => ({
            id: oraclePlaceId(oracle.coords),
            kind: PlaceKind.Oracle,
            spaces: [oracle.coords]
        }))
        return [...this.cities.map((city) => this.cityPlace(city)), ...villages, ...oracles]
    }

    place(placeId: PlaceId): Place | undefined {
        return this.places().find((place) => place.id === placeId)
    }

    network(): Network {
        return buildNetwork(this)
    }

    roadEntersSpace(road: RoadTile, coords: AxialCoordinates): boolean {
        return road.ends.some((end) => sameCoordinates(neighborCoords(road.coords, end), coords))
    }

    playerRoadEnters(playerId: string, coords: AxialCoordinates): boolean {
        return ClockwisePointyHexDirections.some((direction) => {
            const road = this.roadAt(neighborCoords(coords, direction))
            return road?.playerId === playerId && road.ends.includes(oppositeDirection(direction))
        })
    }

    adjacentCities(coords: AxialCoordinates): City[] {
        const neighbors = ClockwisePointyHexDirections.map((direction) =>
            neighborCoords(coords, direction)
        )
        return this.cities.filter((city) =>
            city.spaces.some((space) =>
                neighbors.some((neighbor) => sameCoordinates(space, neighbor))
            )
        )
    }

    adjacentOpenVillages(coords: AxialCoordinates): AxialCoordinates[] {
        return ClockwisePointyHexDirections.map((direction) =>
            neighborCoords(coords, direction)
        ).filter((neighbor) => this.isOpenVillage(neighbor))
    }

    isAdjacentToOracle(coords: AxialCoordinates): boolean {
        return ClockwisePointyHexDirections.some(
            (direction) => !!this.oracleAt(neighborCoords(coords, direction))
        )
    }

    marketsAt(placeId: PlaceId): Market[] {
        return this.markets.filter((market) => market.placeId === placeId)
    }

    marketOf(playerId: string, placeId: PlaceId): Market | undefined {
        return this.markets.find(
            (market) => market.playerId === playerId && market.placeId === placeId
        )
    }

    marketsRemaining(playerId: string): number {
        return (
            MARKETS_PER_PLAYER -
            this.markets.filter((market) => market.playerId === playerId).length
        )
    }

    addRoad(road: RoadTile) {
        this.roads.push(road)
    }

    foundCity(playerId: string, coords: AxialCoordinates): City {
        const city: City = { id: `C${this.nextCityNumber}`, playerId, spaces: [coords] }
        this.nextCityNumber += 1
        this.cities.push(city)
        this.absorbVillage(city, coords)
        return city
    }

    extendCity(cityId: string, coords: AxialCoordinates): string[] {
        const city = this.city(cityId)
        city.spaces.push(coords)
        this.absorbVillage(city, coords)
        const mergedIds = this.adjacentCities(coords)
            .filter((other) => other.id !== city.id && other.playerId === city.playerId)
            .map((other) => other.id)
        for (const mergedId of mergedIds) {
            this.mergeCity(city, this.city(mergedId))
        }
        return mergedIds
    }

    addMarket(market: Market) {
        this.markets.push(market)
    }

    updateOracleAttention(network: Network): OracleChange[] {
        const changes: OracleChange[] = []
        for (const oracle of this.oracles) {
            const connected = network.neighbors(oraclePlaceId(oracle.coords))
            const importance = (cityId: string) => network.connectionCount(cityPlaceId(cityId))
            const best = this.cities
                .filter((city) => connected.includes(cityPlaceId(city.id)))
                .reduce<
                    City | undefined
                >((leader, city) => (!leader || importance(city.id) > importance(leader.id) ? city : leader), undefined)
            if (!best) {
                continue
            }
            const current = oracle.attentionCityId
            const currentImportance = current === undefined ? -1 : importance(current)
            if (best.id !== current && importance(best.id) > currentImportance) {
                changes.push({ oracle: oracle.coords, fromCityId: current, toCityId: best.id })
                oracle.attentionCityId = best.id
            }
        }
        return changes
    }

    private absorbVillage(city: City, coords: AxialCoordinates) {
        const villageId = villagePlaceId(coords)
        this.relocateMarkets(villageId, cityPlaceId(city.id))
    }

    private mergeCity(into: City, merged: City) {
        into.spaces.push(...merged.spaces)
        this.cities = this.cities.filter((city) => city.id !== merged.id)
        this.relocateMarkets(cityPlaceId(merged.id), cityPlaceId(into.id))
        for (const oracle of this.oracles) {
            if (oracle.attentionCityId === merged.id) {
                oracle.attentionCityId = into.id
            }
        }
    }

    // Merging never lifts a market: it keeps its tile and sold flag and scores for the new place.
    private relocateMarkets(fromPlaceId: PlaceId, toPlaceId: PlaceId) {
        for (const market of this.marketsAt(fromPlaceId)) {
            market.placeId = toPlaceId
        }
    }

    private cityPlace(city: City): Place {
        return {
            id: cityPlaceId(city.id),
            kind: PlaceKind.City,
            spaces: city.spaces,
            playerId: city.playerId
        }
    }
}
