import * as Type from 'typebox'
import { cityGood } from '../components/cities.js'
import { Good, type GoodCounts } from '../components/goods.js'
import type { ProjectedCityState } from './city.js'

export const GOODS_PER_PRODUCTION_MARKER = 2

export type Delivery = Type.Static<typeof Delivery>
export const Delivery = Type.Object({
    city: Type.Integer({ minimum: 0 }),
    good: Type.Enum(Good),
    markers: Type.Integer({ minimum: 1 }),
    toCity: Type.Integer({ minimum: 0 }),
    toOffices: Type.Array(Type.String())
})

// Rulebook: cities are supplied from the highest played marker down; offices in a city
// each take one good first, unless there are not enough goods to give every office one.
export function deliverSupplies(
    cities: ProjectedCityState[],
    supply: GoodCounts,
    playedMarkers: readonly number[]
): Delivery[] {
    const values = [...new Set(playedMarkers)].toSorted((a, b) => b - a)
    return values.map((value) => {
        const markers = playedMarkers.filter((marker) => marker === value).length
        return deliverToCity(cities[value], supply, markers * GOODS_PER_PRODUCTION_MARKER, markers)
    })
}

function deliverToCity(
    city: ProjectedCityState,
    supply: GoodCounts,
    wanted: number,
    markers: number
): Delivery {
    const good = cityGood(city.number)
    const amount = takeFromSupply(supply, good, wanted)
    const offices = city.offices.length > 0 && amount >= city.offices.length ? city.offices : []
    for (const office of offices) {
        office.goods += 1
    }
    const toCity = amount - offices.length
    city.goods[good] += toCity
    return {
        city: city.number,
        good,
        markers,
        toCity,
        toOffices: offices.map((office) => office.playerId)
    }
}

export function takeFromSupply(supply: GoodCounts, good: Good, wanted: number): number {
    const amount = Math.min(wanted, supply[good])
    supply[good] -= amount
    return amount
}
