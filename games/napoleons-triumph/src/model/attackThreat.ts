import { assertExists } from '@tabletop/common'
import type { ApproachId } from '../components/battleMap.js'
import { isGuard } from '../components/pieces.js'
import { DefenseAwaits, type ThreatOrder } from './attack.js'
import { canThreaten, mayAttackInPlace, rideOnAttackOrder } from './attackOrders.js'
import { currentAttack, attackLocale, defenseLocale } from './attackState.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { validateDefenseLeaders } from './leaders.js'
import { endRoadMarch } from './movement.js'
import { faceOf, samePosition, type ProjectedUnit } from './pieces.js'
import { distinct, legal } from './legality.js'
import { hasUsableCommand } from './orders.js'

/** Rule 11, step 1. */
export function threatenAttack(
    state: HydratedNapoleonsTriumphGameState,
    attackerId: string,
    attackApproach: ApproachId,
    guardUnitId?: string,
    plan?: ThreatOrder
) {
    legal(state.attack === undefined, 'An attack is already in progress')
    legal(!state.currentRound.night, 'There are no attacks at night')
    const approach = state.map.approach(attackApproach)
    legal(!approach.impassable, 'An impassable approach cannot be attacked across')
    legal(
        state.isEnemyOccupied(approach.neighbour, attackerId),
        'An attack is a move into an enemy-occupied locale'
    )
    legal(
        !state.limits.closedApproaches.includes(attackApproach),
        'No further attack may cross that approach this turn'
    )
    legal(
        canThreaten(state, attackerId, attackApproach),
        'No piece could attack across that approach'
    )
    const defenderId = state.opponentOf(attackerId).playerId
    if (guardUnitId !== undefined) {
        const guard = state.unit(guardUnitId)
        const stance = guard.position
        legal(
            guard.playerId === attackerId && isGuard(faceOf(guard)),
            'A Guard Attack needs Guard infantry'
        )
        legal(
            samePosition(stance, { locale: approach.locale }) ||
                samePosition(stance, { locale: approach.locale, approach: attackApproach }),
            'The Guard must be able to make the attack'
        )
        legal(
            hasUsableCommand(state, guard),
            'That Guard unit can no longer be commanded this turn'
        )
        legal(!approach.obstructed, 'A Guard Attack cannot cross an obstructed approach')
        legal(
            !state.getPlayerState(attackerId).guardAttackForfeited,
            'This army may no longer declare Guard Attacks'
        )
        state.reveal(guard)
    }
    legal(
        plan === undefined ||
            plan.unitIds.every((id) => state.findUnit(id)?.playerId === attackerId),
        'An attack is planned with the attacker’s own units'
    )
    if (!rideOnAttackOrder(state, { attackerId, attackApproach }, state.riders())) {
        endRoadMarch(state)
    }
    state.attack = {
        attackerId,
        defenderId,
        attackPlan: plan ? { playerId: attackerId, order: plan } : undefined,
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
        counterAttackingUnitIds: [],
        attackerStepsLost: 0,
        defenderStepsLost: 0,
        pending: []
    }
}

export function mustDefend(state: HydratedNapoleonsTriumphGameState): boolean {
    return forcedDefense(state) !== undefined
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

/** The defence when pieces block the defense approach: all of them and no others, with no choice in it. */
export function forcedDefense(state: HydratedNapoleonsTriumphGameState): string[] | undefined {
    const attack = currentAttack(state)
    const blockers = state.blockers(attack.defenseApproach, attack.defenderId)
    return blockers.length > 0 ? blockers.map((unit) => unit.id) : undefined
}

/** Rule 11, step 2: the defending pieces. Their leading units are named later, in step 4. */
export function declareDefense(
    state: HydratedNapoleonsTriumphGameState,
    unitIds: readonly string[]
) {
    const attack = currentAttack(state)
    legal(unitIds.length > 0, 'A defense names at least one unit')
    legal(distinct(unitIds), 'A defending unit is named once')
    const units = unitIds.map((id) => state.unit(id))
    const forced = forcedDefense(state)
    if (forced) {
        legal(
            forced.length === unitIds.length && forced.every((id) => unitIds.includes(id)),
            'Every piece blocking the defense approach defends, and no other'
        )
    } else {
        const eligible = eligibleReserveDefenders(state)
        legal(
            units.every((unit) => eligible.includes(unit)),
            'Defending pieces come from the reserve and must still be free to defend'
        )
        legal(
            units.filter((unit) => unit.commanderId === undefined).length <= 1,
            'At most one detached unit defends from reserve'
        )
    }
    attack.defendingUnitIds = [...unitIds]
    attack.defendingCommanderIds = [
        ...new Set(units.flatMap((unit) => (unit.commanderId ? [unit.commanderId] : [])))
    ]
    attack.defendersBlocking = forced !== undefined
    // Rule 15: a Guard Attack cannot be called off, so it goes straight to the defence's leading units.
    attack.awaits = attack.guardAttack ? DefenseAwaits.Leaders : DefenseAwaits.Feint
    for (const unit of units) {
        unit.defendedApproach = attack.defenseApproach
    }
}

/** Rule 11, step 3, when the attack is not called off: it is now the defender's to name the leading units. */
export function pressAttack(state: HydratedNapoleonsTriumphGameState) {
    const attack = currentAttack(state)
    if (attack.defensePlan !== undefined) {
        revealDefenseLeaders(state)
        return
    }
    legal(attack.awaits === DefenseAwaits.Feint, 'The attack is not waiting to be pressed')
    attack.awaits = DefenseAwaits.Leaders
}

export function checkDefenseLeaders(
    state: HydratedNapoleonsTriumphGameState,
    leaderIds: readonly string[]
) {
    const attack = currentAttack(state)
    legal(
        leaderIds.every((id) => attack.defendingUnitIds.includes(id)),
        'Leading units are defending pieces'
    )
    legal(distinct(leaderIds), 'A leading unit is named once')
    validateDefenseLeaders(
        state,
        leaderIds.map((id) => state.unit(id)),
        attack.defenseApproach,
        attack.defendersBlocking === true
    )
}

/** Rule 11, step 4: the defense leading units, turned face-up as they are named. */
export function leadDefense(
    state: HydratedNapoleonsTriumphGameState,
    leaderIds: readonly string[]
) {
    const attack = currentAttack(state)
    legal(attack.awaits === DefenseAwaits.Leaders, 'The defense is not waiting to name its leaders')
    checkDefenseLeaders(state, leaderIds)
    attack.awaits = undefined
    showDefenseLeaders(state, leaderIds)
}

function showDefenseLeaders(
    state: HydratedNapoleonsTriumphGameState,
    leaderIds: readonly string[]
) {
    currentAttack(state).defenseLeaderIds = [...leaderIds]
    state.revealAll(leaderIds.map((id) => state.unit(id)))
}

export function canPressAttack(state: HydratedNapoleonsTriumphGameState): boolean {
    const attack = currentAttack(state)
    const locale = attackLocale(state, attack)
    return [
        ...state.reserveUnits(locale, attack.attackerId),
        ...state.blockers(attack.attackApproach, attack.attackerId)
    ].some((unit) => mayAttackInPlace(state, unit, attack.attackApproach))
}

/** For an attack whose defence named its leading units with its pieces: they are shown as the attacker presses on. */
function revealDefenseLeaders(state: HydratedNapoleonsTriumphGameState) {
    const attack = currentAttack(state)
    assertExists(attack.defensePlan, 'The defense has not been declared')
    const leaderIds = attack.defensePlan.leaderIds
    assertExists(leaderIds, 'The defense leading units are not known here')
    attack.defensePlan = undefined
    showDefenseLeaders(state, leaderIds)
}
