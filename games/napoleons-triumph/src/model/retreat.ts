import { assert } from '@tabletop/common'
import type { LocaleId } from '../components/battleMap.js'
import { UnitType } from '../components/pieces.js'
import { currentAttack, attackLocale, defenseLocale } from './attackState.js'
import type { LossEntry } from './attack.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { faceOf, type ProjectedUnit } from './pieces.js'

/** A group of retreating units that must give up steps between them (rule 12). */
export interface RetreatLossGroup {
    unitIds: string[]
    steps: number
}

export interface RetreatPlan {
    losses: Readonly<Record<string, number>>
    destinations: Readonly<Record<string, LocaleId>>
    kept: Readonly<Record<string, string>>
}

export interface RetreatOutcome {
    losses: LossEntry[]
    stepsLost: number
    eliminatedForRoom: string[]
    demoralized: boolean
}

function strength(units: readonly ProjectedUnit[]): number {
    return units.reduce((sum, unit) => sum + faceOf(unit).strength, 0)
}

export function retreatingUnits(state: HydratedNapoleonsTriumphGameState): ProjectedUnit[] {
    const attack = currentAttack(state)
    return state.unitsIn(defenseLocale(state, attack), attack.defenderId)
}

function isHorseOrFoot(unit: ProjectedUnit): boolean {
    return faceOf(unit).type !== UnitType.Artillery
}

export function retreatLossGroups(state: HydratedNapoleonsTriumphGameState): RetreatLossGroup[] {
    const attack = currentAttack(state)
    const locale = defenseLocale(state, attack)
    const groups: RetreatLossGroup[] = []
    for (const approach of state.map.approachesOf(locale)) {
        if (approach.id === attack.defenseApproach) {
            continue
        }
        const blockers = state.blockers(approach.id, attack.defenderId).filter(isHorseOrFoot)
        if (blockers.length > 0) {
            groups.push({
                unitIds: blockers.map((unit) => unit.id),
                steps: Math.min(approach.wide ? 2 : 1, strength(blockers))
            })
        }
    }
    const idleInfantry = state
        .reserveUnits(locale, attack.defenderId)
        .filter(
            (unit) =>
                faceOf(unit).type === UnitType.Infantry &&
                !attack.defendingUnitIds.includes(unit.id)
        )
    if (idleInfantry.length > 0) {
        const wide = state.map.approach(attack.defenseApproach).wide
        groups.push({
            unitIds: idleInfantry.map((unit) => unit.id),
            steps: Math.min(wide ? 2 : 1, strength(idleInfantry))
        })
    }
    return groups
}

export function retreatRoom(state: HydratedNapoleonsTriumphGameState): Map<LocaleId, number> {
    const attack = currentAttack(state)
    const from = defenseLocale(state, attack)
    const barred = attackLocale(state, attack)
    const room = new Map<LocaleId, number>()
    for (const approach of state.map.passableApproachesOf(from)) {
        const locale = approach.neighbour
        if (locale === barred || state.isEnemyOccupied(locale, attack.defenderId)) {
            continue
        }
        room.set(locale, Math.max(0, state.freeCapacity(locale, attack.defenderId)))
    }
    return room
}

function validateLosses(
    state: HydratedNapoleonsTriumphGameState,
    groups: readonly RetreatLossGroup[],
    losses: Readonly<Record<string, number>>
) {
    const assigned = Object.entries(losses).filter(([, steps]) => steps > 0)
    for (const [unitId, steps] of assigned) {
        assert(Number.isInteger(steps), 'Losses are whole steps')
        assert(
            groups.some((group) => group.unitIds.includes(unitId)),
            `Unit ${unitId} owes no retreat loss`
        )
        assert(
            steps <= faceOf(state.unit(unitId)).strength,
            'A unit cannot lose more steps than it has'
        )
    }
    for (const group of groups) {
        const total = group.unitIds.reduce((sum, id) => sum + (losses[id] ?? 0), 0)
        assert(total === group.steps, `Those units must lose ${group.steps} steps between them`)
    }
}

/** Rule 12. The plan is the retreating player's choices; everything else follows from the rules. */
export function executeRetreat(
    state: HydratedNapoleonsTriumphGameState,
    plan: RetreatPlan
): RetreatOutcome {
    const attack = currentAttack(state)
    const afterCombat = attack.attackerWon === true
    const retreating = retreatingUnits(state)
    state.revealAll(retreating)
    for (const unit of retreating) {
        state.commit(unit)
    }
    const groups = retreatLossGroups(state)
    validateLosses(state, groups, plan.losses)

    const records: LossEntry[] = []
    for (const unit of retreating) {
        if (faceOf(unit).type === UnitType.Artillery) {
            records.push(state.takeLoss(unit, faceOf(unit).strength))
        } else if ((plan.losses[unit.id] ?? 0) > 0) {
            records.push(state.takeLoss(unit, plan.losses[unit.id]))
        }
    }

    const survivors = retreatingUnits(state)
    const room = retreatRoom(state)
    const arrivals = new Map<LocaleId, number>()
    for (const unit of survivors) {
        const destination = plan.destinations[unit.id]
        if (destination === undefined) {
            continue
        }
        assert(room.has(destination), `Unit ${unit.id} cannot retreat to locale ${destination}`)
        arrivals.set(destination, (arrivals.get(destination) ?? 0) + 1)
    }
    for (const [locale, count] of arrivals) {
        assert(count <= (room.get(locale) ?? 0), `Locale ${locale} cannot hold that many units`)
    }
    const stranded = survivors.filter((unit) => plan.destinations[unit.id] === undefined)
    const spare = [...room].reduce(
        (sum, [locale, free]) => sum + free - (arrivals.get(locale) ?? 0),
        0
    )
    assert(
        stranded.length === 0 || spare === 0,
        'Units are lost only when no locale has room for them'
    )

    const corpsIds = [...new Set(survivors.flatMap((unit) => unit.commanderId ?? []))]
    for (const commanderId of corpsIds) {
        const corps = survivors.filter(
            (unit) => unit.commanderId === commanderId && plan.destinations[unit.id] !== undefined
        )
        if (corps.length === 0) {
            continue
        }
        const keptId = corps.length === 1 ? corps[0].id : plan.kept[commanderId]
        const kept = corps.find((unit) => unit.id === keptId)
        assert(kept !== undefined, `Name the unit that stays with ${commanderId}`)
        for (const unit of corps) {
            if (unit !== kept) {
                state.detach(unit)
            }
        }
        state.place([state.commander(commanderId)], { locale: plan.destinations[kept.id] })
    }
    for (const unit of stranded) {
        records.push(state.takeLoss(unit, faceOf(unit).strength))
    }
    for (const unit of survivors) {
        const destination = plan.destinations[unit.id]
        if (destination === undefined) {
            continue
        }
        state.place([unit], { locale: destination })
        if (afterCombat) {
            unit.retreatedAfterCombat = true
        }
    }
    const stepsLost = records.reduce((sum, record) => sum + record.steps, 0)
    const demoralized = state.loseMorale(attack.defenderId, stepsLost)
    return {
        losses: records,
        stepsLost,
        eliminatedForRoom: stranded.map((unit) => unit.id),
        demoralized
    }
}
