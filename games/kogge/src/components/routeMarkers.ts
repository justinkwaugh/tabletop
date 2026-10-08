import { CITY_COUNT, cityGood } from './cities.js'
import type { Good } from './goods.js'

export const ROUTE_MARKER_COUNTS: readonly number[] = [14, 13, 12, 11, 10, 9, 8, 7, 6]

export const OFFER_GROUP_COUNT = 4
export const OFFER_GROUP_SIZE = 2

export function allRouteMarkers(): number[] {
    return ROUTE_MARKER_COUNTS.flatMap((count, value) => Array<number>(count).fill(value))
}

export function startingHand(): number[] {
    return Array.from({ length: CITY_COUNT }, (_, value) => value)
}

export function markerGood(value: number): Good {
    return cityGood(value)
}

export function markerValuesForGood(good: Good): number[] {
    return Array.from({ length: CITY_COUNT }, (_, value) => value).filter(
        (value) => markerGood(value) === good
    )
}

export function sortMarkers(markers: readonly number[]): number[] {
    return markers.toSorted((a, b) => a - b)
}

export function containsMarkers(hand: readonly number[], markers: readonly number[]): boolean {
    const remaining = [...hand]
    for (const marker of markers) {
        const index = remaining.indexOf(marker)
        if (index < 0) {
            return false
        }
        remaining.splice(index, 1)
    }
    return true
}

export function withoutMarkers(hand: readonly number[], markers: readonly number[]): number[] {
    const remaining = [...hand]
    for (const marker of markers) {
        const index = remaining.indexOf(marker)
        if (index < 0) {
            throw Error(`Marker ${marker} is not in hand`)
        }
        remaining.splice(index, 1)
    }
    return remaining
}

export function sameMarkers(a: readonly number[], b: readonly number[]): boolean {
    return a.length === b.length && containsMarkers(a, b)
}

export function countOfMarker(hand: readonly number[], value: number): number {
    return hand.filter((marker) => marker === value).length
}
