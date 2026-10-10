import { assert } from '@tabletop/common'
import { UnitType } from '../components/pieces.js'
import { CommandKind, type MoveOrder } from './attack.js'
import { finishOccupation } from './attackResolution.js'
import { currentAttack, defenseLocale } from './attackState.js'
import { artilleryMayFire, resolveAttackOrders } from './attackOrders.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { isSantonBattery } from './leaders.js'
import { endRoadMarch, relocate, settleRoadMarch } from './movement.js'
import { expendOrder } from './orders.js'
import { faceOf } from './pieces.js'

/**
 * After a retreat before combat the attacker names the attack it threatened and moves in
 * (rule 11, step 2). Artillery that could have led the attack may instead stay in place. Cavalry
 * that moves in by road may ride on afterwards while it has road movement left.
 */
export function occupyAfterRetreat(
    state: HydratedNapoleonsTriumphGameState,
    orders: readonly MoveOrder[],
    artilleryStays: boolean
) {
    const attack = currentAttack(state)
    assert(attack.retreatBeforeCombat === true, 'The defender has not retreated before combat')
    const resolved = resolveAttackOrders(state, attack, orders)
    assert(
        !resolved.artilleryPair || artilleryStays,
        'Two batteries combine only to lead an attack together'
    )
    if (resolved.resolved.every((entry) => entry.march === undefined)) {
        endRoadMarch(state)
    }
    const locale = defenseLocale(state, attack)
    attack.orders = orders.map((order) => ({ ...order }))
    if (artilleryStays) {
        const approach = state.map.approach(attack.attackApproach)
        const inPosition =
            resolved.stance.approach !== undefined ||
            resolved.units.every((unit) => isSantonBattery(state, unit))
        assert(
            inPosition &&
                !resolved.byRoad &&
                resolved.resolved.every((entry) => entry.order.kind !== CommandKind.Corps) &&
                resolved.units.every((unit) => faceOf(unit).type === UnitType.Artillery) &&
                resolved.units.length <= (approach.wide ? 2 : 1) &&
                artilleryMayFire(state, attack.attackApproach),
            'Only artillery that could have led the attack may stay in place'
        )
        state.revealAll(resolved.units)
        for (const entry of resolved.resolved) {
            expendOrder(state, entry)
        }
        finishOccupation(state)
        return
    }
    assert(
        resolved.units.every((unit) => !unit.fixed),
        'The fixed battery cannot move'
    )
    assert(
        resolved.units.length <= state.freeCapacity(locale, attack.attackerId),
        'The locale cannot hold the attacking units'
    )
    for (const entry of resolved.resolved) {
        const road = entry.order.road ? [...entry.order.road, locale] : undefined
        relocate(state, entry, { locale }, road)
        expendOrder(state, entry)
        if (road) {
            settleRoadMarch(state, entry, road, { locale })
        }
    }
    finishOccupation(state)
}
