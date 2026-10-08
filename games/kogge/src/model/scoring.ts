import { cityGood } from '../components/cities.js'
import { goodsValue, GOOD_VICTORY_POINTS } from '../components/goods.js'
import type { ProjectedCityState } from './city.js'
import type { HydratedKoggePlayerState } from './playerState.js'

export const DEVELOPMENT_POINTS_TO_WIN = 5
export const OFFICE_VICTORY_POINTS = 10
export const BONUS_CHIT_VICTORY_POINTS = 20
export const RAID_MARKER_VICTORY_POINTS = 10

export interface ScoreBreakdown {
    offices: number
    bonusChits: number
    raidMarkers: number
    cargo: number
    officeGoods: number
    total: number
}

export function officeCount(cities: readonly ProjectedCityState[], playerId: string): number {
    return cities.reduce(
        (count, city) =>
            count + city.offices.filter((office) => office.playerId === playerId).length,
        0
    )
}

export function developmentPoints(
    cities: readonly ProjectedCityState[],
    player: HydratedKoggePlayerState
): number {
    return officeCount(cities, player.playerId) + player.bonusChits.length
}

export function scoreBreakdown(
    cities: readonly ProjectedCityState[],
    player: HydratedKoggePlayerState
): ScoreBreakdown {
    const offices = officeCount(cities, player.playerId) * OFFICE_VICTORY_POINTS
    const bonusChits = player.bonusChits.length * BONUS_CHIT_VICTORY_POINTS
    const raidMarkers = player.raidMarkers * RAID_MARKER_VICTORY_POINTS
    const cargo = goodsValue(player.goods)
    const officeGoods = cities.reduce(
        (sum, city) =>
            sum +
            city.offices
                .filter((office) => office.playerId === player.playerId)
                .reduce(
                    (officeSum, office) =>
                        officeSum + office.goods * GOOD_VICTORY_POINTS[cityGood(city.number)],
                    0
                ),
        0
    )
    return {
        offices,
        bonusChits,
        raidMarkers,
        cargo,
        officeGoods,
        total: offices + bonusChits + raidMarkers + cargo + officeGoods
    }
}
