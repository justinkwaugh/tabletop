import { assert, assertExists } from '@tabletop/common'
import { DecisionKind, type PendingDecision } from './attack.js'
import { concludeAttack, living, lose, type CombatOutcome } from './attackResolution.js'
import { currentAttack, defensePosition } from './attackState.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { faceOf, samePosition } from './pieces.js'

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
    assertExists(decision, `No ${kind} decision is waiting on that player`)
    attack.pending = attack.pending.filter((candidate) => candidate !== decision)
    return decision
}

export function assignOddLoss(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    unitId: string
): CombatOutcome {
    const decision = takeDecision(state, DecisionKind.OddLoss, playerId)
    assert(decision.unitIds.includes(unitId), 'The odd loss falls on one of the two leading units')
    const loss = lose(state, currentAttack(state), state.unit(unitId), 1)
    return { losses: [loss], morale: concludeAttack(state) }
}

export function assignExcessLosses(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    allocation: Readonly<Record<string, number>>
): CombatOutcome {
    const decision = takeDecision(state, DecisionKind.ExcessLosses, playerId)
    const entries = Object.entries(allocation).filter(([, steps]) => steps > 0)
    assert(
        entries.every(([id]) => decision.unitIds.includes(id)),
        'Excess losses fall on the other units in the attack'
    )
    assert(
        entries.every(
            ([id, steps]) => Number.isInteger(steps) && steps <= faceOf(state.unit(id)).strength
        ),
        'A unit cannot lose more steps than it has'
    )
    const total = entries.reduce((sum, [, steps]) => sum + steps, 0)
    assert(total === decision.amount, `Exactly ${decision.amount} steps must be assigned`)
    const losses = entries.map(([id, steps]) =>
        lose(state, currentAttack(state), state.unit(id), steps)
    )
    return { losses, morale: concludeAttack(state) }
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
        const kept = keep[commanderId]
        assert(
            corps.some((unit) => unit.id === kept),
            `Name the unit that stays with ${commanderId}`
        )
        for (const unit of corps) {
            if (unit.id !== kept) {
                state.detach(unit)
            }
        }
    }
    concludeAttack(state)
}

export function advance(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    unitIds: readonly string[],
    commanderIds: readonly string[]
) {
    const attack = currentAttack(state)
    const decision = takeDecision(state, DecisionKind.Advance, playerId)
    assert(unitIds.length > 0, 'At least one unit must advance to the approach')
    assert(
        unitIds.every((id) => decision.unitIds.includes(id)),
        'Only defending pieces advance'
    )
    const position = defensePosition(state, attack)
    const units = unitIds.map((id) => state.unit(id))
    const commanders = commanderIds.map((id) => state.commander(id))
    for (const commander of commanders) {
        assert(
            commander.playerId === playerId &&
                commander.position !== undefined &&
                samePosition(commander.position, { locale: position.locale }),
            'Only a commander in the defense reserve advances'
        )
        assert(
            units.some((unit) => unit.commanderId === commander.id),
            'A commander advances with a unit of its corps'
        )
    }
    for (const commanderId of new Set(units.flatMap((unit) => unit.commanderId ?? []))) {
        const commander = state.commander(commanderId)
        const remaining = state
            .corpsUnits(commanderId)
            .filter(
                (unit) => samePosition(unit.position, commander.position) && !units.includes(unit)
            )
        assert(
            commanders.includes(commander) || remaining.length > 0,
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
