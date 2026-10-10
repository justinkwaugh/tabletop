import { assert, assertExists } from '@tabletop/common'
import { isGuard } from '../components/pieces.js'
import { MachineState } from '../definition/states.js'
import { canThreaten, hasUsableCommand } from './attackOrders.js'
import { currentAttack, attackLocale, defenseLocale } from './attackState.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { validateDefenseLeaders } from './leaders.js'
import { faceOf, samePosition, type ProjectedUnit } from './pieces.js'

/** Rule 11, step 1. */
export function threatenAttack(
    state: HydratedNapoleonsTriumphGameState,
    attackerId: string,
    attackApproach: number,
    guardUnitId?: string
) {
    assert(state.attack === undefined, 'An attack is already in progress')
    assert(!state.currentRound.night, 'There are no attacks at night')
    const approach = state.map.approach(attackApproach)
    assert(!approach.impassable, 'An impassable approach cannot be attacked across')
    assert(
        state.isEnemyOccupied(approach.neighbour, attackerId),
        'An attack is a move into an enemy-occupied locale'
    )
    assert(
        !state.limits.closedApproaches.includes(attackApproach),
        'No further attack may cross that approach this turn'
    )
    assert(
        canThreaten(state, attackerId, attackApproach),
        'No piece could attack across that approach'
    )
    const defenderId = state.opponentOf(attackerId).playerId
    if (guardUnitId !== undefined) {
        const guard = state.unit(guardUnitId)
        const stance = guard.position
        assert(
            guard.playerId === attackerId && isGuard(faceOf(guard)),
            'A Guard Attack needs Guard infantry'
        )
        assert(
            samePosition(stance, { locale: approach.locale }) ||
                samePosition(stance, { locale: approach.locale, approach: attackApproach }),
            'The Guard must be able to make the attack'
        )
        assert(
            hasUsableCommand(state, guard),
            'That Guard unit can no longer be commanded this turn'
        )
        assert(!approach.obstructed, 'A Guard Attack cannot cross an obstructed approach')
        assert(
            !state.getPlayerState(attackerId).guardAttackForfeited,
            'This army may no longer declare Guard Attacks'
        )
        state.reveal(guard)
    }
    state.attack = {
        step: MachineState.DefenseResponse,
        attackerId,
        defenderId,
        attackApproach,
        defenseApproach: approach.opposite,
        guardAttack: guardUnitId === undefined ? undefined : true,
        defendingUnitIds: [],
        defendingCommanderIds: [],
        defenseLeaderIds: [],
        orders: [],
        attackingUnitIds: [],
        attackingCommanderIds: [],
        attackLeaderIds: [],
        counterAttackerIds: [],
        attackerStepsLost: 0,
        defenderStepsLost: 0,
        pending: []
    }
}

export function mustDefend(state: HydratedNapoleonsTriumphGameState): boolean {
    const attack = currentAttack(state)
    return state.blockers(attack.defenseApproach, attack.defenderId).length > 0
}

export function eligibleReserveDefenders(
    state: HydratedNapoleonsTriumphGameState
): ProjectedUnit[] {
    const attack = currentAttack(state)
    return state
        .reserveUnits(defenseLocale(state, attack), attack.defenderId)
        .filter(
            (unit) =>
                !unit.retreatedAfterCombat &&
                (unit.defendedApproach === undefined ||
                    unit.defendedApproach === attack.defenseApproach)
        )
}

/** Rule 11, steps 2 and 4: the defending pieces, and the leading units held back until step 4. */
export function declareDefense(
    state: HydratedNapoleonsTriumphGameState,
    unitIds: readonly string[],
    leaderIds: readonly string[]
) {
    const attack = currentAttack(state)
    assert(unitIds.length > 0, 'A defense names at least one unit')
    assert(new Set(unitIds).size === unitIds.length, 'A defending unit is named once')
    const units = unitIds.map((id) => state.unit(id))
    const blockers = state.blockers(attack.defenseApproach, attack.defenderId)
    const blocking = blockers.length > 0
    if (blocking) {
        assert(
            blockers.length === units.length && blockers.every((unit) => unitIds.includes(unit.id)),
            'Every piece blocking the defense approach defends, and no other'
        )
    } else {
        const eligible = eligibleReserveDefenders(state)
        assert(
            units.every((unit) => eligible.includes(unit)),
            'Defending pieces come from the reserve and must still be free to defend'
        )
        assert(
            units.filter((unit) => unit.commanderId === undefined).length <= 1,
            'At most one detached unit defends from reserve'
        )
    }
    assert(
        leaderIds.every((id) => unitIds.includes(id)),
        'Leading units are defending pieces'
    )
    assert(new Set(leaderIds).size === leaderIds.length, 'A leading unit is named once')
    validateDefenseLeaders(
        state,
        leaderIds.map((id) => state.unit(id)),
        attack.defenseApproach,
        blocking
    )
    attack.defendingUnitIds = [...unitIds]
    attack.defendingCommanderIds = [
        ...new Set(units.flatMap((unit) => (unit.commanderId ? [unit.commanderId] : [])))
    ]
    attack.defendersBlocking = blocking
    attack.defensePlan = { playerId: attack.defenderId, leaderIds: [...leaderIds] }
    for (const unit of units) {
        unit.defendedApproach = attack.defenseApproach
    }
    attack.step = MachineState.FeintDecision
    if (attack.guardAttack) {
        revealDefenseLeaders(state)
    }
}

export function canPressAttack(state: HydratedNapoleonsTriumphGameState): boolean {
    const attack = currentAttack(state)
    const locale = attackLocale(state, attack)
    return [
        ...state.reserveUnits(locale, attack.attackerId),
        ...state.blockers(attack.attackApproach, attack.attackerId)
    ].some((unit) => hasUsableCommand(state, unit))
}

/** Rule 11, step 4 made public once the attacker presses on. */
export function revealDefenseLeaders(state: HydratedNapoleonsTriumphGameState) {
    const attack = currentAttack(state)
    assertExists(attack.defensePlan, 'The defense has not been declared')
    const leaderIds = attack.defensePlan.leaderIds
    assertExists(leaderIds, 'The defense leading units are not known here')
    attack.defenseLeaderIds = [...leaderIds]
    attack.defensePlan = undefined
    state.revealAll(leaderIds.map((id) => state.unit(id)))
    attack.step = MachineState.AttackDeclaration
}
