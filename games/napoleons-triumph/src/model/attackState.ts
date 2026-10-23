import { assertExists } from '@tabletop/common'
import type { LocaleId } from '../components/battleMap.js'
import { MachineState } from '../definition/states.js'
import { DefenseAwaits, type AttackStep } from './attack.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import type { Position } from './pieces.js'

export type AttackState = NonNullable<HydratedNapoleonsTriumphGameState['attack']>

export function currentAttack(state: HydratedNapoleonsTriumphGameState): AttackState {
    assertExists(state.attack, 'No attack is in progress')
    return state.attack
}

export function isNamedDefender(attack: AttackState, commanderId: string): boolean {
    return attack.defendingCommanderIds.includes(commanderId)
}

/** Rule 11: how far the attack procedure has come, read from what has been declared and resolved. */
export function attackStep(attack: AttackState): AttackStep {
    if (attack.retreatBeforeCombat) {
        return MachineState.Occupying
    }
    if (attack.feint) {
        return MachineState.ResolvingAttack
    }
    if (attack.defendingUnitIds.length === 0) {
        return MachineState.DefenseResponse
    }
    if (attack.defensePlan !== undefined || attack.awaits === DefenseAwaits.Feint) {
        return MachineState.FeintDecision
    }
    if (attack.awaits === DefenseAwaits.Leaders) {
        return MachineState.DefenseDeclaration
    }
    if (attack.initialResult === undefined) {
        return MachineState.AttackDeclaration
    }
    if (attack.attackerWon === undefined) {
        return MachineState.CounterAttackDecision
    }
    return attack.pending.length > 0 ? MachineState.ResolvingAttack : MachineState.Retreating
}

export function attackLocale(
    state: HydratedNapoleonsTriumphGameState,
    attack: AttackState
): LocaleId {
    return state.map.approach(attack.attackApproach).locale
}

export function defenseLocale(
    state: HydratedNapoleonsTriumphGameState,
    attack: AttackState
): LocaleId {
    return state.map.approach(attack.defenseApproach).locale
}

export function defensePosition(
    state: HydratedNapoleonsTriumphGameState,
    attack: AttackState
): Position {
    return { locale: defenseLocale(state, attack), approach: attack.defenseApproach }
}
