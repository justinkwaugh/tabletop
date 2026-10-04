import { TECHS, type TechEffects } from '../components/techs.js'
import type { ScenarioDefinition } from '../components/scenarios.js'
import type { HydratedStellarHorizonsPlayerState } from './playerState.js'

export interface Capabilities {
    canBuySettlements: boolean
    settleHabitability?: number
    terraforms: number
    terraformDraws: number
    cvMalfunction: number
    reMalfunction: number
    cvExplorationBonus: number
    reExplorationBonus: number
    cvMovement: number
    reMovement: number
    cvRange: number
    reRange: number
    cvMaxSize: number
    settlementCost: number
    cloning: boolean
    cargoBonus: number
}

export const CV_MOVEMENT_STEPS: readonly number[] = [5, 4, 3, 2, 1.5, 1, 0.5]
export const MIN_MOVEMENT_MODIFIER = 0.5

const BASELINE = {
    cvMalfunction: 50,
    reMalfunction: 30,
    cvMovement: 5,
    reMovement: 3,
    cvRange: 1,
    reRange: 1,
    cvMaxSize: 2
}

export function playerCapabilities(
    player: HydratedStellarHorizonsPlayerState,
    scenario: ScenarioDefinition
): Capabilities {
    const owned = TECHS.filter((definition) => player.ownsTech(definition.id))
    const values = (key: keyof TechEffects): number[] =>
        owned.flatMap((definition) => {
            const value = definition.effects[key]
            return typeof value === 'number' ? [value] : []
        })
    const has = (key: keyof TechEffects): boolean =>
        owned.some((definition) => definition.effects[key] !== undefined)
    const lowest = (key: keyof TechEffects, baseline: number) => Math.min(baseline, ...values(key))
    const highest = (key: keyof TechEffects, baseline: number) => Math.max(baseline, ...values(key))
    const habitability = values('settleHabitability')

    return {
        canBuySettlements: has('buySettlements'),
        settleHabitability: habitability.length > 0 ? Math.min(...habitability) : undefined,
        terraforms: highest('terraforms', 0),
        terraformDraws: highest('terraformDraws', 1),
        cvMalfunction: lowest('cvMalfunction', BASELINE.cvMalfunction),
        reMalfunction: lowest('reMalfunction', BASELINE.reMalfunction),
        cvExplorationBonus: highest('cvExplorationBonus', 0),
        reExplorationBonus: highest('reExplorationBonus', 0),
        cvMovement: lowest('cvMovement', BASELINE.cvMovement),
        reMovement: lowest('reMovement', BASELINE.reMovement),
        cvRange: highest('cvRange', BASELINE.cvRange),
        reRange: highest('reRange', BASELINE.reRange),
        cvMaxSize: highest('cvMaxSize', BASELINE.cvMaxSize),
        settlementCost: scenario.settlementCost - highest('settlementDiscount', 0),
        cloning: has('cloning'),
        cargoBonus: highest('cargoBonus', 0)
    }
}

export function fastMovementModifier(cvMovement: number): number {
    const index = CV_MOVEMENT_STEPS.indexOf(cvMovement)
    const faster = CV_MOVEMENT_STEPS[index + 1]
    return faster ?? MIN_MOVEMENT_MODIFIER
}
