import { assert } from '@tabletop/common'
import { SANTON_LOCALE } from '../components/austerlitz.js'
import { MachineState } from '../definition/states.js'
import type { MoveOrder } from './attack.js'
import { artilleryMayFire, resolveAttackOrders, type AttackOrders } from './attackOrders.js'
import {
    closeApproach,
    concludeAttack,
    counterAttackCandidates,
    queueAdvance,
    resolveCombat,
    type CombatOutcome
} from './attackResolution.js'
import { attackLocale, currentAttack, defenseLocale, type AttackState } from './attackState.js'
import { initialResult, isArtilleryLed } from './combat.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { santonBatteryPresent, validateAttackLeaders } from './leaders.js'
import { endRoadMarch, relocate } from './movement.js'
import { expendOrder, movingCommander } from './orders.js'
import { faceOf, samePosition, type Position, type ProjectedUnit } from './pieces.js'

function recordAttackers(
    attack: AttackState,
    orders: readonly MoveOrder[],
    resolved: AttackOrders
) {
    attack.orders = orders.map((order) => ({ ...order }))
    attack.attackingUnitIds = resolved.units.map((unit) => unit.id)
    attack.attackingCommanderIds = resolved.resolved.flatMap((entry) => {
        const commander = movingCommander(entry)
        return commander ? [commander.id] : []
    })
}

export enum FeintEnd {
    Reserve = 'Reserve',
    Approach = 'Approach'
}

/** Rule 11, step 3. */
export function declareFeint(
    state: HydratedNapoleonsTriumphGameState,
    orders: readonly MoveOrder[],
    end: FeintEnd
) {
    const attack = currentAttack(state)
    assert(!attack.guardAttack, 'A Guard Attack cannot be a feint')
    const resolved = resolveAttackOrders(state, attack, orders)
    assert(!resolved.artilleryPair, 'Two batteries combine only to lead an attack together')
    const ridingOn = resolved.resolved.some((entry) => entry.march !== undefined)
    if (!ridingOn) {
        endRoadMarch(state)
    }
    const locale = attackLocale(state, attack)
    const blocking: Position = { locale, approach: attack.attackApproach }
    const alreadyThere = resolved.units.every((unit) => unit.position?.locale === locale)
    assert(
        !resolved.byRoad || ridingOn || !alreadyThere,
        'Cavalry already in the attack locale feints without taking the road'
    )
    const startsBlocking = samePosition(resolved.stance, blocking) && !resolved.byRoad
    assert(
        !startsBlocking || end === FeintEnd.Approach,
        'Pieces feinting from the attack approach stay on it'
    )
    const to = end === FeintEnd.Approach ? blocking : { locale }
    assert(
        resolved.units.every((unit) => !unit.fixed) || samePosition(to, resolved.stance),
        'The fixed battery cannot move'
    )
    assert(
        state.freeCapacity(
            locale,
            attack.attackerId,
            alreadyThere ? resolved.units.map((unit) => unit.id) : []
        ) >= resolved.units.length,
        'The attack locale cannot hold those units'
    )
    recordAttackers(attack, orders, resolved)
    attack.feint = true
    for (const entry of resolved.resolved) {
        relocate(state, entry, to, entry.order.road)
        expendOrder(state, entry)
    }
    if (resolved.byRoad) {
        state.revealAll(resolved.units)
        state.roadMarch = undefined
    }
    closeApproach(state, attack)
    queueAdvance(state, attack)
    concludeAttack(state)
}

export interface AttackDeclaration {
    orders: readonly MoveOrder[]
    wide: boolean
    leaderIds: readonly string[]
    targetLeaderId?: string
}

export interface CheckedDeclaration {
    orders: AttackOrders
    leaders: ProjectedUnit[]
    artilleryLed: boolean
    struckLeaderIds: string[]
}

/** Rule 11, step 5: everything an attack declaration must satisfy. Changes nothing. */
export function checkAttackDeclaration(
    state: HydratedNapoleonsTriumphGameState,
    declaration: AttackDeclaration
): CheckedDeclaration {
    const attack = currentAttack(state)
    const orders = resolveAttackOrders(state, attack, declaration.orders)
    assert(!orders.byRoad, 'An attack by road must be a feint')
    const attackApproach = state.map.approach(attack.attackApproach)
    assert(
        !declaration.wide || attackApproach.wide,
        'A narrow approach allows only a narrow attack'
    )
    assert(
        orders.units.length <= state.map.locale(defenseLocale(state, attack)).capacity,
        'The defense locale could not hold the attacking units'
    )
    assert(
        declaration.leaderIds.every((id) => orders.units.some((unit) => unit.id === id)),
        'Leading units are attacking pieces'
    )
    assert(
        new Set(declaration.leaderIds).size === declaration.leaderIds.length,
        'A leading unit is named once'
    )
    const leaders = declaration.leaderIds.map((id) => state.unit(id))
    validateAttackLeaders(state, leaders, {
        attackApproach: attack.attackApproach,
        wide: declaration.wide,
        guardAttack: attack.guardAttack === true,
        attackersBlocking: orders.stance.approach !== undefined,
        orders: orders.resolved
    })
    const artilleryLed = isArtilleryLed(leaders.map(faceOf))
    assert(
        !artilleryLed || artilleryMayFire(state, attack.attackApproach),
        'Artillery may not lead an attack here now'
    )
    assert(
        artilleryLed || orders.units.every((unit) => !unit.fixed),
        'The fixed battery attacks only by leading with its fire'
    )
    assert(
        !orders.artilleryPair || (artilleryLed && leaders.length === 2),
        'Two batteries combine only to lead an attack together'
    )
    const picksTarget = !declaration.wide && attack.defenseLeaderIds.length === 2
    assert(
        !picksTarget ||
            (declaration.targetLeaderId !== undefined &&
                attack.defenseLeaderIds.includes(declaration.targetLeaderId)),
        'A narrow attack names the defense leading unit it strikes'
    )
    const struckLeaderIds =
        picksTarget && declaration.targetLeaderId !== undefined
            ? [declaration.targetLeaderId]
            : [...attack.defenseLeaderIds]
    return { orders, leaders, artilleryLed, struckLeaderIds }
}

/** Rule 11, step 6, for a declaration that has passed its checks. */
export function initialResultOf(
    state: HydratedNapoleonsTriumphGameState,
    checked: CheckedDeclaration
): number {
    const attack = currentAttack(state)
    const defenseApproach = state.map.approach(attack.defenseApproach)
    return initialResult({
        attackLeaders: checked.leaders.map(faceOf),
        defenseLeaders: checked.struckLeaderIds.map((id) => faceOf(state.unit(id))),
        defendersBlocking: attack.defendersBlocking === true,
        approachPenalties: defenseApproach.penalties,
        penaltiesApplyInReserve:
            defenseApproach.locale === SANTON_LOCALE && santonBatteryPresent(state),
        guardAttack: attack.guardAttack === true
    })
}

/** Rule 11, steps 5 and 6. Resolves the attack outright when no counter-attack is possible. */
export function declareAttack(
    state: HydratedNapoleonsTriumphGameState,
    declaration: AttackDeclaration
): CombatOutcome | undefined {
    const attack = currentAttack(state)
    const checked = checkAttackDeclaration(state, declaration)
    endRoadMarch(state)
    // Rule 11, step 5: a leader a narrow attack passes by "is no longer considered a leading unit", so it is not committed.
    attack.defenseLeaderIds = checked.struckLeaderIds
    recordAttackers(attack, declaration.orders, checked.orders)
    attack.wide = declaration.wide
    attack.attackLeaderIds = [...declaration.leaderIds]
    attack.artilleryLed = checked.artilleryLed
    for (const entry of checked.orders.resolved) {
        expendOrder(state, entry)
    }
    state.revealAll(checked.leaders)
    for (const unit of [
        ...checked.leaders,
        ...checked.struckLeaderIds.map((id) => state.unit(id))
    ]) {
        state.commit(unit)
    }
    attack.initialResult = initialResultOf(state, checked)
    if (counterAttackCandidates(state).length > 0) {
        attack.step = MachineState.CounterAttackDecision
        return undefined
    }
    return resolveCombat(state, [])
}
