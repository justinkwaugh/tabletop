import { assert, assertExists } from '@tabletop/common'
import { UnitType, sameFace } from '../components/pieces.js'
import { MachineState } from '../definition/states.js'
import { DecisionKind, type LossEntry, type PendingDecision } from './attack.js'
import { attackLocale, currentAttack, defenseLocale, type AttackState } from './attackState.js'
import {
    attackerLossPoints,
    attackerWins,
    counterAttackStrength,
    defenderLossPoints,
    splitEvenly
} from './combat.js'
import { VictoryKind, type HydratedNapoleonsTriumphGameState } from './gameState.js'
import { validateCounterAttackers } from './leaders.js'
import { faceOf, type Commander, type ProjectedUnit } from './pieces.js'
import { declareVictory } from './victory.js'

export function closeApproach(state: HydratedNapoleonsTriumphGameState, attack: AttackState) {
    if (!state.limits.closedApproaches.includes(attack.attackApproach)) {
        state.limits.closedApproaches.push(attack.attackApproach)
    }
}

export function queueAdvance(state: HydratedNapoleonsTriumphGameState, attack: AttackState) {
    if (attack.defendersBlocking !== false) {
        return
    }
    const unitIds = attack.defendingUnitIds.filter((id) => {
        const unit = state.findUnit(id)
        return unit !== undefined && !unit.fixed
    })
    if (unitIds.length > 0) {
        attack.pending.push({ kind: DecisionKind.Advance, playerId: attack.defenderId, unitIds })
    }
}

function tiebreak(state: HydratedNapoleonsTriumphGameState, attack: AttackState) {
    return {
        defendersBlocking: attack.defendersBlocking === true,
        attackingUnits: attack.attackingUnitIds.length,
        defendingUnits: attack.defendingUnitIds.length,
        attackerSide: state.sideOf(attack.attackerId)
    }
}

export function attackerLeadsInitially(state: HydratedNapoleonsTriumphGameState): boolean {
    const attack = currentAttack(state)
    assertExists(attack.initialResult, 'The attack has not been declared')
    return attackerWins(attack.initialResult, tiebreak(state, attack))
}

export function counterAttackCandidates(state: HydratedNapoleonsTriumphGameState): ProjectedUnit[] {
    const attack = currentAttack(state)
    if (attack.artilleryLed) {
        return []
    }
    return attack.defendingUnitIds
        .filter((id) => !attack.defenseLeaderIds.includes(id))
        .flatMap((id) => state.findUnit(id) ?? [])
}

function recordLoss(attack: AttackState, playerId: string, loss: LossEntry) {
    if (playerId === attack.attackerId) {
        attack.attackerStepsLost += loss.steps
    } else {
        attack.defenderStepsLost += loss.steps
    }
}

export function lose(
    state: HydratedNapoleonsTriumphGameState,
    attack: AttackState,
    unit: ProjectedUnit,
    steps: number
): LossEntry {
    state.reveal(unit)
    const loss = state.takeLoss(unit, steps)
    recordLoss(attack, unit.playerId, loss)
    return loss
}

/** Rule 11, step 8: the initial result less the counter-attackers at the strength their loss leaves them. */
export function finalResultWith(
    state: HydratedNapoleonsTriumphGameState,
    counterAttackers: readonly ProjectedUnit[]
): number {
    const attack = currentAttack(state)
    assertExists(attack.initialResult, 'The attack has not been declared')
    return attack.initialResult - counterAttackStrength(counterAttackers.map(faceOf))
}

/** Rule 11, steps 7 and 8, then the resolution that follows. */
export function counterAttack(
    state: HydratedNapoleonsTriumphGameState,
    unitIds: readonly string[]
): CombatOutcome {
    const attack = currentAttack(state)
    assertExists(attack.initialResult, 'The attack has not been declared')
    const candidates = counterAttackCandidates(state)
    assert(new Set(unitIds).size === unitIds.length, 'A counter-attacking unit is named once')
    const units = unitIds.map((id) => state.unit(id))
    assert(
        units.every((unit) => candidates.includes(unit)),
        'Only defending units that are not leading counter-attack'
    )
    validateCounterAttackers(state, units, attack.defenseApproach, attackerLeadsInitially(state))
    attack.counterAttackerIds = [...unitIds]
    attack.finalResult = finalResultWith(state, units)
    for (const unit of units) {
        state.commit(unit)
    }
    return resolveCombat(
        state,
        units.map((unit) => lose(state, attack, unit, 1))
    )
}

export function living(
    state: HydratedNapoleonsTriumphGameState,
    ids: readonly string[]
): ProjectedUnit[] {
    return ids.flatMap((id) => state.findUnit(id) ?? [])
}

function loseEvenly(
    state: HydratedNapoleonsTriumphGameState,
    attack: AttackState,
    units: readonly ProjectedUnit[],
    losses: number,
    chooserId: string,
    records: LossEntry[]
): number {
    if (units.length === 0 || losses <= 0) {
        return Math.max(0, losses)
    }
    const split = splitEvenly(
        units.map((unit) => faceOf(unit).strength),
        losses
    )
    const odd = split.oddBetween?.map((index) => units[index])
    const interchangeable = odd !== undefined && sameFace(faceOf(odd[0]), faceOf(odd[1]))
    units.forEach((unit, index) => {
        const steps = split.taken[index] + (interchangeable && odd && unit === odd[0] ? 1 : 0)
        if (steps > 0) {
            records.push(lose(state, attack, unit, steps))
        }
    })
    if (odd && !interchangeable) {
        attack.pending.push({
            kind: DecisionKind.OddLoss,
            playerId: chooserId,
            unitIds: [odd[0].id, odd[1].id]
        })
    }
    return split.excess
}

function queueExcess(
    state: HydratedNapoleonsTriumphGameState,
    attack: AttackState,
    ownerId: string,
    candidates: readonly ProjectedUnit[],
    amount: number,
    records: LossEntry[]
) {
    if (amount <= 0 || candidates.length === 0) {
        return
    }
    const capacity = candidates.reduce((sum, unit) => sum + faceOf(unit).strength, 0)
    if (candidates.length === 1 || amount >= capacity) {
        for (const unit of candidates) {
            records.push(lose(state, attack, unit, Math.min(amount, faceOf(unit).strength)))
        }
        return
    }
    attack.pending.push({
        kind: DecisionKind.ExcessLosses,
        playerId: ownerId,
        amount,
        unitIds: candidates.map((unit) => unit.id)
    })
}

export interface CombatOutcome {
    losses: LossEntry[]
    morale?: MoraleOutcome
    finalResult?: number
    attackerWon?: boolean
}

/** Rule 11, steps 8 to 10: the final result and every loss that needs no choice. */
export function resolveCombat(
    state: HydratedNapoleonsTriumphGameState,
    records: LossEntry[]
): CombatOutcome {
    const attack = currentAttack(state)
    assertExists(attack.initialResult, 'The attack has not been declared')
    const final = attack.finalResult ?? attack.initialResult
    attack.finalResult = final
    attack.attackerWon = attackerWins(final, tiebreak(state, attack))
    attack.step = MachineState.ResolvingAttack

    const attackLeaders = living(state, attack.attackLeaderIds)
    const attackLeaderFaces = attackLeaders.map(faceOf)
    const defenseLeaders = living(state, attack.defenseLeaderIds)
    const defenseLeaderFaces = defenseLeaders.map(faceOf)

    const attackerLoss = attackerLossPoints(attackLeaderFaces, defenseLeaders.length, final)
    const defenderLoss = defenderLossPoints(attackLeaderFaces, defenseLeaderFaces, final)

    const attackerExcess = loseEvenly(
        state,
        attack,
        attackLeaders,
        attackerLoss,
        attack.defenderId,
        records
    )
    queueExcess(
        state,
        attack,
        attack.attackerId,
        living(state, attack.attackingUnitIds).filter(
            (unit) => !attack.attackLeaderIds.includes(unit.id)
        ),
        attackerExcess,
        records
    )

    const fightingLeaders = defenseLeaders.filter(
        (unit) => faceOf(unit).type !== UnitType.Artillery
    )
    const afterLeaders = loseEvenly(
        state,
        attack,
        fightingLeaders,
        defenderLoss,
        attack.attackerId,
        records
    )
    const counterAttackers = living(state, attack.counterAttackerIds)
    const afterCounterAttackers = loseEvenly(
        state,
        attack,
        counterAttackers,
        afterLeaders,
        attack.attackerId,
        records
    )
    const others = living(state, attack.defendingUnitIds).filter(
        (unit) => !fightingLeaders.includes(unit) && !attack.counterAttackerIds.includes(unit.id)
    )
    queueExcess(state, attack, attack.defenderId, others, afterCounterAttackers, records)
    const attackerWon = attack.attackerWon
    return { losses: records, morale: concludeAttack(state), finalResult: final, attackerWon }
}

function isLossDecision(decision: PendingDecision): boolean {
    return decision.kind === DecisionKind.OddLoss || decision.kind === DecisionKind.ExcessLosses
}

export function concludeAttack(
    state: HydratedNapoleonsTriumphGameState
): MoraleOutcome | undefined {
    const attack = currentAttack(state)
    let morale: MoraleOutcome | undefined
    const fought = !attack.feint && !attack.retreatBeforeCombat
    if (fought && !attack.lossesSettled) {
        if (attack.pending.some(isLossDecision)) {
            return undefined
        }
        morale = settleLosses(state)
        if (morale.demoralizedId !== undefined) {
            declareVictory(
                state,
                state.opponentOf(morale.demoralizedId).playerId,
                VictoryKind.Decisive
            )
            state.attack = undefined
            return morale
        }
        if (completeAttack(state)) {
            attack.step = MachineState.Retreating
            return morale
        }
    }
    if (attack.pending.length > 0) {
        attack.step = MachineState.ResolvingAttack
        return morale
    }
    endAttack(state)
    return morale
}

export interface MoraleOutcome {
    loserId?: string
    moraleLost: number
    demoralizedId?: string
}

/** Rule 13: the loser pays morale for the strength it lost; a failed Guard Attack costs more. */
function settleLosses(state: HydratedNapoleonsTriumphGameState): MoraleOutcome {
    const attack = currentAttack(state)
    assert(!attack.pending.some(isLossDecision), 'Losses are still being assigned')
    assert(attack.attackerWon !== undefined, 'The attack has not been resolved')
    attack.lossesSettled = true
    const loserId = attack.attackerWon ? attack.defenderId : attack.attackerId
    const moraleLost = attack.attackerWon ? attack.defenderStepsLost : attack.attackerStepsLost
    let demoralized = state.loseMorale(loserId, moraleLost, attack.artilleryLed === true)
    if (!attack.attackerWon && attack.guardAttack && !demoralized) {
        demoralized = state.failGuardAttack(attack.attackerId)
    }
    return { loserId, moraleLost, demoralizedId: demoralized ? loserId : undefined }
}

function attackingPieces(
    state: HydratedNapoleonsTriumphGameState,
    attack: AttackState
): (ProjectedUnit | Commander)[] {
    return [
        ...living(state, attack.attackingUnitIds),
        ...attack.attackingCommanderIds
            .map((id) => state.commander(id))
            .filter((commander) => !commander.eliminated)
    ]
}

function occupyDefenseLocale(state: HydratedNapoleonsTriumphGameState) {
    const attack = currentAttack(state)
    const locale = defenseLocale(state, attack)
    state.place(attackingPieces(state, attack), { locale })
    for (const unit of living(state, attack.attackingUnitIds)) {
        unit.enteredReserveThisTurn = true
    }
}

function repulse(state: HydratedNapoleonsTriumphGameState, attack: AttackState) {
    const locale = attackLocale(state, attack)
    state.place(attackingPieces(state, attack), { locale })
    closeApproach(state, attack)
    const survivors = living(state, attack.attackingUnitIds)
    const choices: string[] = []
    for (const commanderId of attack.attackingCommanderIds) {
        const corps = survivors.filter((unit) => unit.commanderId === commanderId)
        if (corps.length > 1) {
            choices.push(commanderId)
        }
    }
    if (choices.length > 0) {
        attack.pending.push({
            kind: DecisionKind.Regroup,
            playerId: attack.attackerId,
            commanderIds: choices
        })
    }
    queueAdvance(state, attack)
}

/** Rule 11, step 11, once losses are settled. Returns whether the beaten defender still has pieces that must retreat. */
function completeAttack(state: HydratedNapoleonsTriumphGameState): boolean {
    const attack = currentAttack(state)
    if (attack.artilleryLed) {
        state.artilleryFire[String(attack.attackApproach)] = state.round
        if (!state.limits.bombardedApproaches.includes(attack.attackApproach)) {
            state.limits.bombardedApproaches.push(attack.attackApproach)
        }
        return false
    }
    if (!attack.attackerWon) {
        repulse(state, attack)
        return false
    }
    const locale = defenseLocale(state, attack)
    state.limits.stormedLocales.push(locale)
    if (state.piecesOnMap(attack.defenderId).some((piece) => piece.position?.locale === locale)) {
        return true
    }
    occupyDefenseLocale(state)
    return false
}

function endAttack(state: HydratedNapoleonsTriumphGameState) {
    const attack = currentAttack(state)
    assert(attack.pending.length === 0, 'Decisions are still waiting')
    if (
        !attack.attackerWon &&
        !attack.artilleryLed &&
        !attack.feint &&
        !attack.retreatBeforeCombat
    ) {
        for (const commanderId of attack.attackingCommanderIds) {
            const corps = living(state, attack.attackingUnitIds).filter(
                (unit) => unit.commanderId === commanderId
            )
            corps.slice(1).forEach((unit) => state.detach(unit))
        }
    }
    state.attack = undefined
}

export function afterRetreat(state: HydratedNapoleonsTriumphGameState, demoralized: boolean) {
    const attack = currentAttack(state)
    if (demoralized) {
        declareVictory(state, attack.attackerId, VictoryKind.Decisive)
        state.attack = undefined
        return
    }
    if (attack.retreatBeforeCombat) {
        attack.step = MachineState.Occupying
        return
    }
    occupyDefenseLocale(state)
    endAttack(state)
}

export function finishOccupation(state: HydratedNapoleonsTriumphGameState) {
    endAttack(state)
}
