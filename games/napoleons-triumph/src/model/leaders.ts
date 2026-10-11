import { SANTON_LOCALE } from '../components/austerlitz.js'
import { unitsAbreast, type ApproachId } from '../components/battleMap.js'
import { UnitType, isGuard } from '../components/pieces.js'
import { CommandKind } from './attack.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import type { ResolvedOrder } from './orders.js'
import { faceOf, inReserve, type ProjectedUnit } from './pieces.js'
import { legal } from './legality.js'

/** The French fixed battery fights from the Santon's reserve as if it blocked every approach (rule 18). */
export function isSantonBattery(
    state: HydratedNapoleonsTriumphGameState,
    unit: ProjectedUnit
): boolean {
    return (
        state.santon &&
        unit.fixed === true &&
        unit.position?.locale === SANTON_LOCALE &&
        inReserve(unit.position)
    )
}

export function santonBatteryPresent(state: HydratedNapoleonsTriumphGameState): boolean {
    return state.units.some((unit) => isSantonBattery(state, unit))
}

function artilleryBarredOnSanton(
    state: HydratedNapoleonsTriumphGameState,
    unit: ProjectedUnit
): boolean {
    return (
        state.santon &&
        unit.position?.locale === SANTON_LOCALE &&
        !unit.fixed &&
        faceOf(unit).type === UnitType.Artillery
    )
}

interface Pairing {
    /** Units in reserve pair only within one corps (rule 11, steps 4 and 7). */
    sameCorps: boolean
    /** Guard infantry does not pair with other infantry to attack or counter-attack (rule 15). */
    guardsApart: boolean
}

function assertPairable(units: readonly ProjectedUnit[], pairing: Pairing) {
    if (units.length < 2) {
        return
    }
    const [first, second] = units.map(faceOf)
    legal(first.type === second.type, 'Paired leading units must be of the same type')
    legal(
        !pairing.guardsApart || isGuard(first) === isGuard(second),
        'Guard infantry cannot be paired with other infantry'
    )
    if (pairing.sameCorps) {
        legal(
            units[0].commanderId !== undefined && units[0].commanderId === units[1].commanderId,
            'Units in reserve can only be paired when they belong to the same corps'
        )
    }
}

/** Rule 11, step 4. */
export function validateDefenseLeaders(
    state: HydratedNapoleonsTriumphGameState,
    leaders: readonly ProjectedUnit[],
    defenseApproach: ApproachId,
    blocking: boolean
) {
    const approach = state.map.approach(defenseApproach)
    legal(leaders.length <= unitsAbreast(approach.wide), 'Too many defense leading units')
    for (const unit of leaders) {
        const face = faceOf(unit)
        legal(
            !(approach.obstructed && face.type === UnitType.Cavalry),
            'Cavalry cannot lead a defense of an obstructed approach'
        )
        legal(!artilleryBarredOnSanton(state, unit), 'Artillery on the Santon cannot lead')
        if (!blocking && !isSantonBattery(state, unit)) {
            legal(face.strength > 1, 'A one-strength unit in reserve cannot lead a defense')
        }
    }
    if (!blocking) {
        assertPairable(leaders, { sameCorps: true, guardsApart: false })
    }
}

export interface AttackLeaderContext {
    attackApproach: ApproachId
    wide: boolean
    guardAttack: boolean
    attackersBlocking: boolean
    orders: readonly ResolvedOrder[]
}

/** Rule 11, step 5, apart from the limits on repeated artillery fire. */
export function validateAttackLeaders(
    state: HydratedNapoleonsTriumphGameState,
    leaders: readonly ProjectedUnit[],
    context: AttackLeaderContext
) {
    const attackApproach = state.map.approach(context.attackApproach)
    const defenseApproach = state.map.opposite(context.attackApproach)
    legal(leaders.length <= unitsAbreast(context.wide), 'Too many attack leading units')
    assertPairable(leaders, { sameCorps: false, guardsApart: true })
    for (const unit of leaders) {
        const face = faceOf(unit)
        const order = context.orders.find((entry) => entry.units.includes(unit))?.order
        if (face.type === UnitType.Artillery) {
            legal(
                order?.kind !== CommandKind.Corps,
                'A Corps Move attack cannot be led by artillery'
            )
            legal(
                context.attackersBlocking || isSantonBattery(state, unit),
                'Artillery leads an attack only from the attack approach'
            )
            legal(!artilleryBarredOnSanton(state, unit), 'Artillery on the Santon cannot lead')
        } else {
            legal(face.strength > 1, 'A one-strength unit cannot lead an attack')
        }
        legal(
            !(defenseApproach.obstructed && face.type === UnitType.Cavalry),
            'Cavalry cannot lead an attack on an obstructed approach'
        )
        if (context.guardAttack) {
            legal(isGuard(face), 'A Guard Attack is led by Guard infantry')
        }
    }
    if (context.guardAttack) {
        legal(leaders.length > 0, 'A Guard Attack needs a Guard leading unit')
        legal(!attackApproach.obstructed, 'A Guard Attack cannot cross an obstructed approach')
    }
}

/** Rule 11, step 7. */
export function validateCounterAttackers(
    state: HydratedNapoleonsTriumphGameState,
    units: readonly ProjectedUnit[],
    defenseApproach: ApproachId,
    attackerWonInitially: boolean
) {
    const approach = state.map.approach(defenseApproach)
    legal(units.length <= 2, 'At most two units counter-attack')
    if (units.length === 2) {
        assertPairable(units, { sameCorps: true, guardsApart: true })
    }
    for (const unit of units) {
        const face = faceOf(unit)
        legal(face.type !== UnitType.Artillery, 'Artillery cannot counter-attack')
        if (face.type === UnitType.Infantry) {
            legal(
                attackerWonInitially,
                'Infantry counter-attacks only when the attacker is winning'
            )
        } else {
            legal(
                !approach.obstructed,
                'Cavalry cannot counter-attack across an obstructed approach'
            )
        }
    }
}
