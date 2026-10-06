import type { AxialCoordinates, Point } from '@tabletop/common'
import {
    PlaceKind,
    cityPlaceId,
    directionBetween,
    isMarketActive,
    oraclePlaceId,
    spaceKey,
    type HydratedBoard,
    type Market,
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

// Markets gather on their place's anchor tile, one slot each, so a merged city shows its markets
// together. A place holding more than the slots allow (a city merged before a merge removed second
// markets) spills on to its next tile.
function marketLayout(
    board: HydratedBoard
): { market: Market; tile: AxialCoordinates; slot: Point }[] {
    const slotsUsed = new Map<PlaceId, number>()
    return board.markets.map((market) => {
        const place = board.marketPlace(market)
        const index = slotsUsed.get(place.id) ?? 0
        slotsUsed.set(place.id, index + 1)
        const spaceIndex = Math.floor(index / MARKET_SLOTS.length) % place.spaces.length
        return {
            market,
            tile: place.spaces[spaceIndex],
            slot: MARKET_SLOTS[index % MARKET_SLOTS.length]
        }
    })
}

export function marketTile(board: HydratedBoard, market: Market): AxialCoordinates {
    const placed = marketLayout(board).find((entry) => entry.market === market)
    return placed?.tile ?? market.coords
}

export function marketViews(board: HydratedBoard, network: Network): MarketView[] {
    return marketLayout(board).map(({ market, tile, slot }) => {
        const center = hexCenter(tile)
        return {
            key: `${spaceKey(market.coords)}:${market.playerId}`,
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
