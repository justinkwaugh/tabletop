import { Good } from './goods.js'

export type CityNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export interface CityInfo {
    number: CityNumber
    name: string
    good: Good
}

export const CITIES: readonly CityInfo[] = [
    { number: 0, name: 'Tönsberg', good: Good.Ore },
    { number: 1, name: 'Stockholm', good: Good.Ore },
    { number: 2, name: 'Åbo', good: Good.Ore },
    { number: 3, name: 'Reval', good: Good.Fur },
    { number: 4, name: 'Riga', good: Good.Fur },
    { number: 5, name: 'Danzig', good: Good.Amber },
    { number: 6, name: 'Stralsund', good: Good.Amber },
    { number: 7, name: 'Lübeck', good: Good.Salt },
    { number: 8, name: 'Kopenhagen', good: Good.Salt }
]

export const CITY_COUNT = CITIES.length
export const MAX_OFFICES_PER_CITY = 2
export const STARTING_CITY_GOODS = 3

export function cityInfo(city: number): CityInfo {
    const info = CITIES[city]
    if (!info) {
        throw Error(`No city numbered ${city}`)
    }
    return info
}

export function cityGood(city: number): Good {
    return cityInfo(city).good
}

export function isCityNumber(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value < CITY_COUNT
}

export function nextCityClockwise(city: number): number {
    return (city + 1) % CITY_COUNT
}

export function goodsForeignTo(city: number): Good[] {
    const produced = cityGood(city)
    return [Good.Ore, Good.Fur, Good.Amber, Good.Salt].filter((good) => good !== produced)
}
