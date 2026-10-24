import {
    ECOLOGY_COMPOST_WORM_VALUE,
    ECOLOGY_DEAD_FIELD_PENALTY,
    ECOLOGY_FIELD_WORM_VALUE,
    ECOLOGY_GOOD_FIELD_VALUE,
    ECOLOGY_PLACE_POINTS,
    ECOLOGY_STARTING_VALUE,
    ECOLOGY_SUNFLOWER_VALUE,
    ECONOMY_GOOD_FIELD_VALUE,
    ECONOMY_PLACE_POINTS,
    ECONOMY_WORM_VALUE
} from '../components/costs.js'
import type { Standing } from './gameState.js'
import type { HydratedDickeKartoffelnPlayerState } from './playerState.js'

export type EconomyBreakdown = {
    cash: number
    debt: number
    goodFields: number
    worms: number
    total: number
}

export type EcologyBreakdown = {
    fieldWorms: number
    compostWorms: number
    sunflowers: number
    goodFields: number
    deadFields: number
    startingValue: number
    total: number
}

export function economy(player: HydratedDickeKartoffelnPlayerState): EconomyBreakdown {
    const worms = player.fieldWorms() + player.compostWorms()
    const goodFields = player.goodFields()
    return {
        cash: player.cash,
        debt: player.debt(),
        goodFields,
        worms,
        total:
            player.cash -
            player.debt() +
            goodFields * ECONOMY_GOOD_FIELD_VALUE +
            worms * ECONOMY_WORM_VALUE
    }
}

export function ecology(
    player: HydratedDickeKartoffelnPlayerState,
    strict: boolean
): EcologyBreakdown {
    const startingValue = strict ? ECOLOGY_STARTING_VALUE : 0
    const fieldWorms = player.fieldWorms()
    const compostWorms = player.compostWorms()
    const sunflowers = player.sunflowers()
    const goodFields = player.goodFields()
    const deadFields = player.deadFields()
    return {
        fieldWorms,
        compostWorms,
        sunflowers,
        goodFields,
        deadFields,
        startingValue,
        total:
            fieldWorms * ECOLOGY_FIELD_WORM_VALUE +
            compostWorms * ECOLOGY_COMPOST_WORM_VALUE +
            sunflowers * ECOLOGY_SUNFLOWER_VALUE +
            goodFields * ECOLOGY_GOOD_FIELD_VALUE -
            deadFields * ECOLOGY_DEAD_FIELD_PENALTY -
            startingValue
    }
}

// Tied farmers share the better place.
function placePoints(value: number, values: number[], points: readonly number[]): number {
    const place = values.filter((other) => other > value).length
    return points[place] ?? 0
}

export function standings(
    players: readonly HydratedDickeKartoffelnPlayerState[],
    strictEcology: boolean
): Standing[] {
    const economies = players.map((player) => economy(player).total)
    const ecologies = players.map((player) => ecology(player, strictEcology).total)
    return players.map((player, index) => {
        const economyPoints = placePoints(economies[index], economies, ECONOMY_PLACE_POINTS)
        const ecologyPoints =
            ecologies[index] < 0
                ? 0
                : placePoints(ecologies[index], ecologies, ECOLOGY_PLACE_POINTS)
        return {
            playerId: player.playerId,
            economy: economies[index],
            ecology: ecologies[index],
            economyPoints,
            ecologyPoints,
            points: economyPoints + ecologyPoints
        }
    })
}
