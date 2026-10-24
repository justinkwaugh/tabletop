import { unitsAbreast } from '../components/battleMap.js'
import { UnitType } from '../components/pieces.js'
import { CommandKind, type MoveOrder } from './attack.js'
import { endAttack } from './attackResolution.js'
import { currentAttack, defenseLocale } from './attackState.js'
import { artilleryMayFire, resolveAttackOrders } from './attackOrders.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { artilleryBarredOnSanton, isSantonBattery } from './leaders.js'
import { endRoadMarch, relocate, requireRoom, settleRoadMarch } from './movement.js'
import { expendOrder } from './orders.js'
import { faceOf } from './pieces.js'
import { legal } from './legality.js'

/** Rule 11, step 2: after a retreat before combat the attacker names the attack it threatened and moves in, unless artillery that could have led it stays in place. */
export function occupyAfterRetreat(
    state: HydratedNapoleonsTriumphGameState,
    orders: readonly MoveOrder[],
    artilleryStays: boolean
) {
    const attack = currentAttack(state)
    legal(attack.retreatBeforeCombat === true, 'The defender has not retreated before combat')
    const resolved = resolveAttackOrders(state, attack, orders)
    legal(
        !resolved.artilleryPair || artilleryStays,
        'Two batteries combine only to lead an attack together'
    )
    if (resolved.commands.every((command) => command.march === undefined)) {
        endRoadMarch(state)
    }
    const locale = defenseLocale(state, attack)
    attack.orders = orders.map((order) => ({ ...order }))
    if (artilleryStays) {
        const approach = state.map.approach(attack.attackApproach)
        const inPosition =
            resolved.stance.approach !== undefined ||
            resolved.units.every((unit) => isSantonBattery(state, unit))
        legal(
            inPosition &&
                !resolved.byRoad &&
                resolved.commands.every((command) => command.order.kind !== CommandKind.Corps) &&
                resolved.units.every((unit) => faceOf(unit).type === UnitType.Artillery) &&
                resolved.units.every((unit) => !artilleryBarredOnSanton(state, unit)) &&
                resolved.units.length <= unitsAbreast(approach.wide) &&
                artilleryMayFire(state, attack.attackerId, attack.attackApproach),
            'Only artillery that could have led the attack may stay in place'
        )
        state.revealAll(resolved.units)
        for (const command of resolved.commands) {
            expendOrder(state, command)
        }
        endAttack(state)
        return
    }
    legal(
        resolved.units.every((unit) => !unit.fixed),
        'The fixed battery cannot move'
    )
    requireRoom(state, attack.attackerId, resolved.units, locale)
    for (const command of resolved.commands) {
        const road = command.order.road ? [...command.order.road, locale] : undefined
        relocate(state, command, { locale }, road)
        expendOrder(state, command)
        if (road) {
            // Rulebook Attack Example 1: cavalry riding in by road is shown as it takes the locale, before it rides on.
            state.revealAll(command.units)
            settleRoadMarch(state, command, road, { locale })
        }
    }
    endAttack(state)
}
