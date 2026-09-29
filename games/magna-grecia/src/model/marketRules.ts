import { PlaceKind, cityPlaceId, type Place } from '../components/places.js'
import type { Market } from '../components/pieces.js'
import type { HydratedBoard } from './board.js'
import type { Network } from './network.js'

export function marketCost(board: HydratedBoard, playerId: string, place: Place): number {
    const base = place.kind === PlaceKind.City ? place.spaces.length : 1
    const rivals = board
        .marketsAt(place.id)
        .filter((market) => market.playerId !== playerId && !market.sold).length
    return base + rivals
}

export function isMarketSite(place: Place, playerId: string): boolean {
    return (
        place.kind === PlaceKind.Village ||
        (place.kind === PlaceKind.City && place.playerId !== playerId)
    )
}

export function canBuildMarket(
    board: HydratedBoard,
    playerId: string,
    place: Place,
    points: number
): boolean {
    return (
        isMarketSite(place, playerId) &&
        !board.marketOf(playerId, place.id) &&
        board.marketsRemaining(playerId) > 0 &&
        points >= marketCost(board, playerId, place)
    )
}

export function isMarketActive(board: HydratedBoard, network: Network, market: Market): boolean {
    const ownCityIds = board.cities
        .filter((city) => city.playerId === market.playerId)
        .map((city) => cityPlaceId(city.id))
    return (
        ownCityIds.includes(market.placeId) ||
        network.neighbors(market.placeId).some((placeId) => ownCityIds.includes(placeId))
    )
}

export function marketValue(board: HydratedBoard, network: Network, market: Market): number {
    return !market.sold && isMarketActive(board, network, market)
        ? network.connectionCount(market.placeId)
        : 0
}
