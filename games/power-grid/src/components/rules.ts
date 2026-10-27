import { assertExists } from '@tabletop/common'

export enum Step {
    One = 1,
    Two = 2,
    Three = 3
}

export const STARTING_MONEY = 50
export const HOUSES_PER_PLAYER = 22
export const MAX_PLANTS = 3
export const FIRST_ROUND_MARKET_SIZE = 8
export const STEP_3_MARKET_SIZE = 6
export const CURRENT_MARKET_SIZE = 4
export const DISCOUNT_MINIMUM_BID = 1

/** Building costs for the first, second and third house in a city. */
export const HOUSE_COSTS = [10, 15, 20] as const

type PlayerCountRules = {
    regions: number
    removedPlugPlants: number
    removedSocketPlants: number
    step2Cities: number
    endCities: number
}

// Recharged rulebook pp. 2, 7, 8.
const PLAYER_COUNT_RULES: Record<number, PlayerCountRules> = {
    2: {
        regions: 3,
        removedPlugPlants: 1,
        removedSocketPlants: 5,
        step2Cities: 7,
        endCities: 18
    },
    3: {
        regions: 3,
        removedPlugPlants: 2,
        removedSocketPlants: 6,
        step2Cities: 7,
        endCities: 17
    },
    4: {
        regions: 4,
        removedPlugPlants: 1,
        removedSocketPlants: 3,
        step2Cities: 7,
        endCities: 17
    },
    5: {
        regions: 5,
        removedPlugPlants: 0,
        removedSocketPlants: 0,
        step2Cities: 7,
        endCities: 15
    },
    6: {
        regions: 5,
        removedPlugPlants: 0,
        removedSocketPlants: 0,
        step2Cities: 6,
        endCities: 14
    }
}

export function playerCountRules(playerCount: number): PlayerCountRules {
    const rules = PLAYER_COUNT_RULES[playerCount]
    assertExists(rules, `Power Grid has no rules for ${playerCount} players`)
    return rules
}

/** Elektro earned for powering 0–20 cities; more than 20 earn the same as 20. */
export const PAYMENTS = [
    10, 22, 33, 44, 54, 64, 73, 82, 90, 98, 105, 112, 118, 124, 129, 134, 138, 142, 145, 148, 150
] as const

export function payment(citiesPowered: number): number {
    return PAYMENTS[Math.min(citiesPowered, PAYMENTS.length - 1)]
}

export function houseSlots(step: Step): number {
    return step
}

export function marketSize(step: Step): number {
    return step === Step.Three ? STEP_3_MARKET_SIZE : FIRST_ROUND_MARKET_SIZE
}

export function auctionableCount(step: Step): number {
    return step === Step.Three ? STEP_3_MARKET_SIZE : CURRENT_MARKET_SIZE
}
