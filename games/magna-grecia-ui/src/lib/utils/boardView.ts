import type { AxialCoordinates, Point } from '@tabletop/common'
import {
    PlaceKind,
    cityPlaceId,
    directionBetween,
    isMarketActive,
    oraclePlaceId,
    spaceKey,
    type HydratedBoard,
    type Network,
    type Place,
    type PlaceId,
    type RoadTile
} from '@tabletop/magna-grecia'
import { directionAngle, hexCenter } from './boardGeometry.js'
import { cityLayout, type CityLayout } from './cityLayout.js'

export type OracleView = {
    key: string
    center: Point
    attention?: { playerId: string; angle: number }
}

export type RoadView = {
    key: string
    center: Point
    road: RoadTile
}

export type CityView = {
    key: string
    playerId: string
    layout: CityLayout
}

export type MarketView = {
    key: string
    point: Point
    playerId: string
    sold: boolean
    active: boolean
}

export type ConnectionBadge = {
    key: PlaceId
    point: Point
    count: number
}

const MARKET_SLOTS: Point[] = [
    { x: -32.5, y: 12 },
    { x: -11, y: 17 },
    { x: 11, y: 17 },
    { x: 32.5, y: 12 }
]

export function placeAnchor(place: Place): AxialCoordinates {
    return place.spaces[0]
}

export function placeCenter(place: Place): Point {
    return hexCenter(placeAnchor(place))
}

export function roadViews(board: HydratedBoard): RoadView[] {
    return board.roads.map((road) => ({
        key: `${spaceKey(road.coords)}`,
        center: hexCenter(road.coords),
        road
    }))
}

export function cityViews(board: HydratedBoard): CityView[] {
    return board.cities.map((city) => ({
        key: city.id,
        playerId: city.playerId,
        layout: cityLayout(city.spaces, city.spaces[0])
    }))
}

export function ghostCityLayout(
    board: HydratedBoard,
    coords: AxialCoordinates,
    joinsCityId?: string
): CityLayout {
    const founding = joinsCityId ? board.city(joinsCityId).spaces[0] : coords
    return cityLayout([coords], founding)
}

export function oracleViews(board: HydratedBoard, network: Network): OracleView[] {
    return board.oracles.map((oracle) => {
        const center = hexCenter(oracle.coords)
        const key = oraclePlaceId(oracle.coords)
        const cityId = oracle.attentionCityId
        if (!cityId) {
            return { key, center }
        }
        const city = board.city(cityId)
        const connection = network
            .connectionsOf(key)
            .find(({ placeIds }) => placeIds.includes(cityPlaceId(cityId)))
        const firstRoad =
            connection &&
            (connection.placeIds[0] === key ? connection.roads[0] : connection.roads.at(-1))
        const direction = firstRoad ? directionBetween(oracle.coords, firstRoad) : undefined
        return {
            key,
            center,
            attention: {
                playerId: city.playerId,
                angle: direction ? directionAngle(direction) : -90
            }
        }
    })
}

export function marketViews(board: HydratedBoard, network: Network): MarketView[] {
    const slotsUsed = new Map<string, number>()
    return board.markets.map((market) => {
        const tileKey = `${market.coords.q},${market.coords.r}`
        const index = slotsUsed.get(tileKey) ?? 0
        slotsUsed.set(tileKey, index + 1)
        const center = hexCenter(market.coords)
        const slot = MARKET_SLOTS[index % MARKET_SLOTS.length]
        return {
            key: `${tileKey}:${index}`,
            point: { x: center.x + slot.x, y: center.y + slot.y },
            playerId: market.playerId,
            sold: market.sold,
            active: !market.sold && isMarketActive(board, network, market)
        }
    })
}

export function connectionBadges(board: HydratedBoard, network: Network): ConnectionBadge[] {
    return board
        .places()
        .filter((place) => place.kind !== PlaceKind.Oracle)
        .map((place) => ({ place, count: network.connectionCount(place.id) }))
        .filter(({ count }) => count > 0)
        .map(({ place, count }) => {
            const center = placeCenter(place)
            return { key: place.id, point: { x: center.x + 29, y: center.y - 32 }, count }
        })
}
