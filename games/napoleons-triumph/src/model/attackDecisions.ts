import { DecisionKind, type PendingDecision } from './attack.js'
import {
    concludeAttack,
    concludeCombat,
    living,
    lose,
    type CombatCost,
    type CombatOutcome
} from './attackResolution.js'
import { currentAttack, defensePosition } from './attackState.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { faceOf, samePosition, type Commander, type ProjectedUnit } from './pieces.js'
import { distinct, legal } from './legality.js'

export function nextDecision(
    state: HydratedNapoleonsTriumphGameState
): PendingDecision | undefined {
    return state.attack?.pending[0]
}

function takeDecision<Kind extends DecisionKind>(
    state: HydratedNapoleonsTriumphGameState,
    kind: Kind,
    playerId: string
): Extract<PendingDecision, { kind: Kind }> {
    const attack = currentAttack(state)
    const decision = attack.pending.find(
        (candidate): candidate is Extract<PendingDecision, { kind: Kind }> =>
            candidate.kind === kind && candidate.playerId === playerId
    )
    legal(decision !== undefined, `No ${kind} decision is waiting on that player`)
    attack.pending = attack.pending.filter((candidate) => candidate !== decision)
    return decision
}

export function assignOddLoss(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    unitId: string
): CombatOutcome {
    const decision = takeDecision(state, DecisionKind.OddLoss, playerId)
    legal(decision.unitIds.includes(unitId), 'The odd loss falls on one of the two leading units')
    const cost: CombatCost = { losses: [], penalties: [] }
    lose(state, currentAttack(state), state.unit(unitId), 1, cost)
    return concludeCombat(state, cost)
}

export function assignExcessLosses(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    allocation: Readonly<Record<string, number>>
): CombatOutcome {
    const decision = takeDecision(state, DecisionKind.ExcessLosses, playerId)
    const entries = Object.entries(allocation).filter(([, steps]) => steps > 0)
    legal(
        entries.every(([id]) => decision.unitIds.includes(id)),
        'Excess losses fall on the other units in the attack'
    )
    legal(
        entries.every(
            ([id, steps]) => Number.isInteger(steps) && steps <= faceOf(state.unit(id)).strength
        ),
        'A unit cannot lose more steps than it has'
    )
    const total = entries.reduce((sum, [, steps]) => sum + steps, 0)
    legal(total === decision.amount, `Exactly ${decision.amount} steps must be assigned`)
    const cost: CombatCost = { losses: [], penalties: [] }
    for (const [id, steps] of entries) {
        lose(state, currentAttack(state), state.unit(id), steps, cost)
    }
    return concludeCombat(state, cost)
}

/** After a repulse every attacking unit but one per corps leaves its corps (rule 11, step 11). */
export function regroup(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    keep: Readonly<Record<string, string>>
) {
    const attack = currentAttack(state)
    const decision = takeDecision(state, DecisionKind.Regroup, playerId)
    for (const commanderId of decision.commanderIds) {
        const corps = living(state, attack.attackingUnitIds).filter(
            (unit) => unit.commanderId === commanderId
        )
        const kept = corps.find((unit) => unit.id === keep[commanderId])
        legal(kept !== undefined, `Name the unit that stays with ${commanderId}`)
        state.detachAllBut(kept, corps)
    }
    concludeAttack(state)
}

export interface ForcedAdvance {
    playerId: string
    unitIds: string[]
    commanderIds: string[]
}

export function forcedAdvance(state: HydratedNapoleonsTriumphGameState): ForcedAdvance | undefined {
    const decision = nextDecision(state)
    if (decision?.kind !== DecisionKind.Advance || decision.unitIds.length !== 1) {
        return undefined
    }
    const [unitId] = decision.unitIds
    const unit = state.unit(unitId)
    const forced = { playerId: decision.playerId, unitIds: [unitId] }
    if (unit.commanderId === undefined) {
        return { ...forced, commanderIds: [] }
    }
    const commander = state.commander(unit.commanderId)
    if (unitsLeftWith(state, commander, [unit]).length === 0) {
        return { ...forced, commanderIds: [commander.id] }
    }
    // A commander who was not named stays with the others; a named one may go or stay.
    const named = currentAttack(state).defendingCommanderIds.includes(commander.id)
    return named ? undefined : { ...forced, commanderIds: [] }
}

/** The units of a commander's corps that stay with him when the given units leave his position. */
function unitsLeftWith(
    state: HydratedNapoleonsTriumphGameState,
    commander: Commander,
    leaving: readonly ProjectedUnit[]
): ProjectedUnit[] {
    return state
        .corpsUnits(commander.id)
        .filter(
            (unit) => samePosition(unit.position, commander.position) && !leaving.includes(unit)
        )
}

export function advance(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    unitIds: readonly string[],
    commanderIds: readonly string[]
) {
    const attack = currentAttack(state)
    const decision = takeDecision(state, DecisionKind.Advance, playerId)
    legal(unitIds.length > 0, 'At least one unit must advance to the approach')
    legal(distinct(unitIds) && distinct(commanderIds), 'A piece advances once')
    legal(
        unitIds.every((id) => decision.unitIds.includes(id)),
        'Only defending pieces advance'
    )
    const position = defensePosition(state, attack)
    const units = unitIds.map((id) => state.unit(id))
    const commanders = commanderIds.map((id) => state.commander(id))
    for (const commander of commanders) {
        legal(
            commander.playerId === playerId &&
                commander.position !== undefined &&
                samePosition(commander.position, { locale: position.locale }),
            'Only a commander in the defense reserve advances'
        )
        legal(
            units.some((unit) => unit.commanderId === commander.id),
            'A commander advances with a unit of its corps'
        )
        legal(
            attack.defendingCommanderIds.includes(commander.id) ||
                unitsLeftWith(state, commander, units).length === 0,
            'Only a named commander advances, unless he goes with his last unit'
        )
    }
    for (const commanderId of new Set(units.flatMap((unit) => unit.commanderId ?? []))) {
        const commander = state.commander(commanderId)
        legal(
            commanders.includes(commander) || unitsLeftWith(state, commander, units).length > 0,
            'A commander goes forward with the last unit standing with it'
        )
    }
    state.place([...units, ...commanders], position)
    for (const commanderId of new Set(
        state.unitsIn(position.locale, playerId).flatMap((unit) => unit.commanderId ?? [])
    )) {
        const commander = state.commander(commanderId)
        for (const unit of state.corpsUnits(commanderId)) {
            if (!samePosition(unit.position, commander.position)) {
                state.detach(unit)
            }
        }
    }
    concludeAttack(state)
}
