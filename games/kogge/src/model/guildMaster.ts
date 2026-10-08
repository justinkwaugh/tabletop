import { CITY_COUNT, nextCityClockwise } from '../components/cities.js'
import { isRaided, type ProjectedCityState } from './city.js'
import type { GuildMaster } from './turn.js'

export const GUILD_MASTER_LAPS = 2
export const GUILD_MASTER_GOODS = 2
export const GUILD_MASTER_STEP_CHOICES: readonly number[] = [1, 2]

export interface GuildMasterPath {
    stops: number[]
    distance: number
}

// Rulebook: the guild master walks clockwise over land and skips raided cities.
export function guildMasterPath(
    guildMaster: GuildMaster,
    cities: readonly ProjectedCityState[],
    steps: number
): GuildMasterPath {
    const stops: number[] = []
    let city = guildMaster.city
    let distance = 0
    for (let step = 0; step < steps; step++) {
        do {
            city = nextCityClockwise(city)
            distance += 1
            if (distance > CITY_COUNT * steps) {
                throw Error('Every city has been raided')
            }
        } while (isRaided(cities[city]))
        stops.push(city)
    }
    return { stops, distance }
}

export function finishesGame(guildMaster: GuildMaster): boolean {
    return guildMaster.distance >= GUILD_MASTER_LAPS * CITY_COUNT
}

export function lapsCompleted(guildMaster: GuildMaster): number {
    return Math.floor(guildMaster.distance / CITY_COUNT)
}
