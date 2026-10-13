import { SANTON_LOCALE } from '../components/austerlitz.js'
import type { MoveOrder, ResultTerm } from './attack.js'
import { artilleryMayFire, resolveAttackOrders, type AttackOrders } from './attackOrders.js'
import {
    closeApproach,
    concludeAttack,
    counterAttackCandidates,
    queueAdvance,
    resolveCombat,
    type CombatCost,
    type CombatOutcome
} from './attackResolution.js'
import { attackLocale, currentAttack, defenseLocale, type AttackState } from './attackState.js'
import { initialResult, initialResultTerms, isArtilleryLed, type Engagement } from './combat.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { santonBatteryPresent, validateAttackLeaders } from './leaders.js'
import { endRoadMarch, relocate, requireRoom } from './movement.js'
import { expendOrder, movingCommander } from './orders.js'
import { faceOf, samePosition, type Position, type ProjectedUnit } from './pieces.js'
import { legal } from './legality.js'

function recordAttackers(
    attack: AttackState,
    orders: readonly MoveOrder[],
    resolved: AttackOrders
) {
    attack.orders = orders.map((order) => ({ ...order }))
    attack.attackingUnitIds = resolved.units.map((unit) => unit.id)
    attack.attackingCommanderIds = resolved.commands.flatMap(
        (command) => movingCommander(command)?.id ?? []
    )
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
    legal(!attack.guardAttack, 'A Guard Attack cannot be a feint')
    const resolved = resolveAttackOrders(state, attack, orders)
    legal(!resolved.artilleryPair, 'Two batteries combine only to lead an attack together')
    const ridingOn = resolved.commands.some((command) => command.march !== undefined)
    if (!ridingOn) {
        endRoadMarch(state)
    }
    const locale = attackLocale(state, attack)
    const blocking: Position = { locale, approach: attack.attackApproach }
    const alreadyThere = resolved.units.every((unit) => unit.position?.locale === locale)
    legal(
        !resolved.byRoad || ridingOn || !alreadyThere,
        'Cavalry already in the attack locale feints without taking the road'
    )
    const startsBlocking = samePosition(resolved.stance, blocking) && !resolved.byRoad
    legal(
        !startsBlocking || end === FeintEnd.Approach,
        'Pieces feinting from the attack approach stay on it'
    )
    const to = end === FeintEnd.Approach ? blocking : { locale }
    legal(
        resolved.units.every((unit) => !unit.fixed) || samePosition(to, resolved.stance),
        'The fixed battery cannot move'
    )
    requireRoom(state, attack.attackerId, resolved.units, locale)
    recordAttackers(attack, orders, resolved)
    attack.feint = true
    for (const command of resolved.commands) {
        relocate(state, command, to, command.order.road)
        expendOrder(state, command)
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

/** Rule 11, step 5. */
export function checkAttackDeclaration(
    state: HydratedNapoleonsTriumphGameState,
    declaration: AttackDeclaration
): CheckedDeclaration {
    const attack = currentAttack(state)
    const orders = resolveAttackOrders(state, attack, declaration.orders)
    legal(!orders.byRoad, 'An attack by road must be a feint')
    const attackApproach = state.map.approach(attack.attackApproach)
    legal(!declaration.wide || attackApproach.wide, 'A narrow approach allows only a narrow attack')
    legal(
        orders.units.length <= state.map.locale(defenseLocale(state, attack)).capacity,
        'The defense locale could not hold the attacking units'
    )
    legal(
        declaration.leaderIds.every((id) => orders.units.some((unit) => unit.id === id)),
        'Leading units are attacking pieces'
    )
    legal(
        new Set(declaration.leaderIds).size === declaration.leaderIds.length,
        'A leading unit is named once'
    )
    const leaders = declaration.leaderIds.map((id) => state.unit(id))
    validateAttackLeaders(state, leaders, {
        attackApproach: attack.attackApproach,
        wide: declaration.wide,
        guardAttack: attack.guardAttack === true,
        attackersBlocking: orders.stance.approach !== undefined,
        orders: orders.commands
    })
    const artilleryLed = isArtilleryLed(leaders.map(faceOf))
    legal(
        !artilleryLed || artilleryMayFire(state, attack.attackApproach),
        'Artillery may not lead an attack here now'
    )
    legal(
        artilleryLed || orders.units.every((unit) => !unit.fixed),
        'The fixed battery attacks only by leading with its fire'
    )
    legal(
        !orders.artilleryPair || (artilleryLed && leaders.length === 2),
        'Two batteries combine only to lead an attack together'
    )
    const picksTarget = !declaration.wide && attack.defenseLeaderIds.length === 2
    legal(
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

function engagementOf(
    state: HydratedNapoleonsTriumphGameState,
    checked: CheckedDeclaration
): Engagement {
    const attack = currentAttack(state)
    const defenseApproach = state.map.approach(attack.defenseApproach)
    return {
        attackLeaders: checked.leaders.map(faceOf),
        defenseLeaders: checked.struckLeaderIds.map((id) => faceOf(state.unit(id))),
        defendersBlocking: attack.defendersBlocking === true,
        approachPenalties: defenseApproach.penalties,
        penaltiesApplyInReserve:
            defenseApproach.locale === SANTON_LOCALE && santonBatteryPresent(state),
        guardAttack: attack.guardAttack === true
    }
}

/** Rule 11, step 6. */
export function initialResultOf(
    state: HydratedNapoleonsTriumphGameState,
    checked: CheckedDeclaration
): number {
    return initialResult(engagementOf(state, checked))
}

/** What the initial result of a declaration is made of, term by term. */
export function initialAccountOf(
    state: HydratedNapoleonsTriumphGameState,
    checked: CheckedDeclaration
): ResultTerm[] {
    return initialResultTerms(engagementOf(state, checked))
}

export interface DeclaredAttack {
    initialResult: number
    account: ResultTerm[]
    /** While a counter-attack may still be made this holds only what the declaration itself cost. */
    outcome: CombatOutcome
}

/** Rule 11, steps 5 and 6; with no counter-attack possible the attack is resolved at once. */
export function declareAttack(
    state: HydratedNapoleonsTriumphGameState,
    declaration: AttackDeclaration
): DeclaredAttack {
    const attack = currentAttack(state)
    const checked = checkAttackDeclaration(state, declaration)
    endRoadMarch(state)
    // Rule 11, step 5: a leader a narrow attack passes by "is no longer considered a leading unit", so it is not committed.
    attack.defenseLeaderIds = checked.struckLeaderIds
    recordAttackers(attack, declaration.orders, checked.orders)
    attack.wide = declaration.wide
    attack.attackLeaderIds = [...declaration.leaderIds]
    attack.artilleryLed = checked.artilleryLed
    for (const command of checked.orders.commands) {
        expendOrder(state, command)
    }
    state.revealAll(checked.leaders)
    const cost: CombatCost = {
        losses: [],
        penalties: [
            ...checked.leaders,
            ...checked.struckLeaderIds.map((id) => state.unit(id))
        ].flatMap((unit) => state.commit(unit))
    }
    const initialResult = initialResultOf(state, checked)
    const account = initialAccountOf(state, checked)
    attack.initialResult = initialResult
    return {
        initialResult,
        account,
        outcome: counterAttackCandidates(state).length > 0 ? cost : resolveCombat(state, cost)
    }
}
