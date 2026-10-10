import { assertExists } from '@tabletop/common'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import type { Position } from './pieces.js'

export type AttackState = NonNullable<HydratedNapoleonsTriumphGameState['attack']>

export function currentAttack(state: HydratedNapoleonsTriumphGameState): AttackState {
    assertExists(state.attack, 'No attack is in progress')
    return state.attack
}

export function attackLocale(
    state: HydratedNapoleonsTriumphGameState,
    attack: AttackState
): number {
    return state.map.approach(attack.attackApproach).locale
}

export function defenseLocale(
    state: HydratedNapoleonsTriumphGameState,
    attack: AttackState
): number {
    return state.map.approach(attack.defenseApproach).locale
}

export function defensePosition(
    state: HydratedNapoleonsTriumphGameState,
    attack: AttackState
): Position {
    return { locale: defenseLocale(state, attack), approach: attack.defenseApproach }
}
