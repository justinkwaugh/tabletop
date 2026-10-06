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
    toCityId: Type.String(),
    toPlayerId: Type.Optional(Type.String())
})

export type Board = Type.Static<typeof Board>
export const Board = Type.Object({
    roads: Type.Array(RoadTile),
    cities: Type.Array(City),
    oracles: Type.Array(Oracle),
    markets: Type.Array(Market),
    lostMarkets: Type.Optional(Type.Record(Type.String(), Type.Number())),
    nextCityNumber: Type.Number()
})

export const BoardValidator = Compile(Board)

export class HydratedBoard extends Hydratable<typeof Board> implements Board {
    declare roads: RoadTile[]
    declare cities: City[]
    declare oracles: Oracle[]
    declare markets: Market[]
    declare lostMarkets?: Record<string, number>
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

    marketPlace(market: Market): Place {
        const place = this.placeAt(market.coords)
        assertExists(place, `No place under the market at ${market.coords.q},${market.coords.r}`)
        return place
    }

    marketsAt(placeId: PlaceId): Market[] {
        return this.markets.filter((market) => this.marketPlace(market).id === placeId)
    }

    marketOf(playerId: string, placeId: PlaceId): Market | undefined {
        return this.marketsAt(placeId).find((market) => market.playerId === playerId)
    }

    marketsRemaining(playerId: string): number {
        return (
            MARKETS_PER_PLAYER -
            this.markets.filter((market) => market.playerId === playerId).length -
            (this.lostMarkets?.[playerId] ?? 0)
        )
    }

    addRoad(road: RoadTile) {
        this.roads.push(road)
    }

    foundCity(playerId: string, coords: AxialCoordinates): City {
        const city: City = { id: `C${this.nextCityNumber}`, playerId, spaces: [coords] }
        this.nextCityNumber += 1
        this.cities.push(city)
        return city
    }

    extendCity(
        cityId: string,
        coords: AxialCoordinates
    ): { mergedCityIds: string[]; removedMarkets: Market[] } {
        const city = this.city(cityId)
        const settledSpaces = [...city.spaces]
        city.spaces.push(coords)
        const mergedCityIds = this.adjacentCities(coords)
            .filter((other) => other.id !== city.id && other.playerId === city.playerId)
            .map((other) => other.id)
        for (const mergedId of mergedCityIds) {
            this.mergeCity(city, this.city(mergedId))
        }
        return { mergedCityIds, removedMarkets: this.removeExcessMarkets(city, settledSpaces) }
    }

    addMarket(market: Market) {
        this.markets.push(market)
    }

    // A player may hold one market per city, so when a merge or a claimed village gives one a
    // second, the market they would rather lose leaves the game: a sold one before an unsold one,
    // then one that came with the absorbed city or village before one already in this city, then
    // the newer.
    private removeExcessMarkets(city: City, settledSpaces: AxialCoordinates[]): Market[] {
        const settled = (market: Market) =>
            settledSpaces.some((space) => sameCoordinates(space, market.coords))
        const kept = new Map<string, Market>()
        for (const market of this.marketsAt(cityPlaceId(city.id))) {
            const current = kept.get(market.playerId)
            if (
                !current ||
                (current.sold && !market.sold) ||
                (current.sold === market.sold && !settled(current) && settled(market))
            ) {
                kept.set(market.playerId, market)
            }
        }
        const removed = this.marketsAt(cityPlaceId(city.id)).filter(
            (market) => kept.get(market.playerId) !== market
        )
        if (removed.length === 0) {
            return []
        }
        this.markets = this.markets.filter((market) => !removed.includes(market))
        const lostMarkets = { ...this.lostMarkets }
        for (const market of removed) {
            lostMarkets[market.playerId] = (lostMarkets[market.playerId] ?? 0) + 1
        }
        this.lostMarkets = lostMarkets
        return removed
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
                changes.push({
                    oracle: oracle.coords,
                    fromCityId: current,
                    toCityId: best.id,
                    toPlayerId: best.playerId
                })
                oracle.attentionCityId = best.id
            }
        }
        return changes
    }

    private mergeCity(into: City, merged: City) {
        into.spaces.push(...merged.spaces)
        this.cities = this.cities.filter((city) => city.id !== merged.id)
        for (const oracle of this.oracles) {
            if (oracle.attentionCityId === merged.id) {
                oracle.attentionCityId = into.id
            }
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
