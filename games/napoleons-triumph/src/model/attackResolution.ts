import { assert, assertExists } from '@tabletop/common'
import { UnitType, sameFace } from '../components/pieces.js'
import {
    DecisionKind,
    type LossEntry,
    type MoralePenalty,
    type PendingDecision,
    type ResultTerm
} from './attack.js'
import { attackLocale, currentAttack, defenseLocale, type AttackState } from './attackState.js'
import {
    attackerLossPoints,
    attackerWins,
    counterAttackStrength,
    counterAttackTerm,
    defenderLossPoints,
    splitEvenly
} from './combat.js'
import { VictoryKind, type HydratedNapoleonsTriumphGameState } from './gameState.js'
import { validateCounterAttackers } from './leaders.js'
import { legal } from './legality.js'
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

/** What an attack has cost so far in the action being played: steps, and morale beyond them. */
export interface CombatCost {
    losses: LossEntry[]
    penalties: MoralePenalty[]
}

export function lose(
    state: HydratedNapoleonsTriumphGameState,
    attack: AttackState,
    unit: ProjectedUnit,
    steps: number,
    cost: CombatCost
) {
    state.reveal(unit)
    cost.penalties.push(...state.commit(unit))
    const loss = state.takeLoss(unit, steps)
    recordLoss(attack, unit.playerId, loss)
    cost.losses.push(loss)
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

/** What a counter-attack by these units takes from the initial result. */
export function counterAttackAccountWith(counterAttackers: readonly ProjectedUnit[]): ResultTerm[] {
    return [counterAttackTerm(counterAttackers.map(faceOf))]
}

/** Rule 11, steps 7 and 8. */
export function counterAttack(
    state: HydratedNapoleonsTriumphGameState,
    unitIds: readonly string[]
): CombatOutcome {
    const attack = currentAttack(state)
    assertExists(attack.initialResult, 'The attack has not been declared')
    const candidates = counterAttackCandidates(state)
    legal(new Set(unitIds).size === unitIds.length, 'A counter-attacking unit is named once')
    const units = unitIds.map((id) => state.unit(id))
    legal(
        units.every((unit) => candidates.includes(unit)),
        'Only defending units that are not leading counter-attack'
    )
    validateCounterAttackers(state, units, attack.defenseApproach, attackerLeadsInitially(state))
    attack.counterAttackingUnitIds = [...unitIds]
    attack.finalResult = finalResultWith(state, units)
    const cost: CombatCost = {
        losses: [],
        penalties: units.flatMap((unit) => state.commit(unit))
    }
    for (const unit of units) {
        lose(state, attack, unit, 1, cost)
    }
    return resolveCombat(state, cost)
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
    cost: CombatCost
): number {
    if (units.length === 0 || losses <= 0) {
        return Math.max(0, losses)
    }
    const split = splitEvenly(
        units.map((unit) => faceOf(unit).strength),
        losses
    )
    const odd = split.oddBetween?.map((index) => units[index])
    const interchangeable =
        odd !== undefined &&
        sameFace(faceOf(odd[0]), faceOf(odd[1])) &&
        odd[0].commanderId === odd[1].commanderId
    units.forEach((unit, index) => {
        const steps = split.taken[index] + (interchangeable && odd && unit === odd[0] ? 1 : 0)
        if (steps > 0) {
            lose(state, attack, unit, steps, cost)
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
    cost: CombatCost
) {
    if (amount <= 0 || candidates.length === 0) {
        return
    }
    const capacity = candidates.reduce((sum, unit) => sum + faceOf(unit).strength, 0)
    if (candidates.length === 1 || amount >= capacity) {
        for (const unit of candidates) {
            lose(state, attack, unit, Math.min(amount, faceOf(unit).strength), cost)
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

export interface CombatOutcome extends CombatCost {
    morale?: MoraleOutcome
    finalResult?: number
    attackerWon?: boolean
}

/** Rule 15: a defeated Guard Attack is paid for after the losses, so its penalty comes last. */
export function concludeCombat(
    state: HydratedNapoleonsTriumphGameState,
    cost: CombatCost
): CombatOutcome {
    const morale = concludeAttack(state)
    const defeat = morale?.guardAttackDefeat
    return {
        losses: cost.losses,
        penalties: defeat ? [...cost.penalties, defeat] : cost.penalties,
        morale
    }
}

/** Rule 11, steps 8 to 10: the final result and every loss that needs no choice. */
export function resolveCombat(
    state: HydratedNapoleonsTriumphGameState,
    cost: CombatCost
): CombatOutcome {
    const attack = currentAttack(state)
    assertExists(attack.initialResult, 'The attack has not been declared')
    const final = attack.finalResult ?? attack.initialResult
    attack.finalResult = final
    attack.attackerWon = attackerWins(final, tiebreak(state, attack))

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
        cost
    )
    queueExcess(
        state,
        attack,
        attack.attackerId,
        living(state, attack.attackingUnitIds).filter(
            (unit) => !attack.attackLeaderIds.includes(unit.id)
        ),
        attackerExcess,
        cost
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
        cost
    )
    const counterAttackers = living(state, attack.counterAttackingUnitIds)
    const afterCounterAttackers = loseEvenly(
        state,
        attack,
        counterAttackers,
        afterLeaders,
        attack.attackerId,
        cost
    )
    const others = living(state, attack.defendingUnitIds).filter(
        (unit) =>
            !fightingLeaders.includes(unit) && !attack.counterAttackingUnitIds.includes(unit.id)
    )
    queueExcess(state, attack, attack.defenderId, others, afterCounterAttackers, cost)
    const attackerWon = attack.attackerWon
    return { ...concludeCombat(state, cost), finalResult: final, attackerWon }
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
        const defenderMustRetreat = completeAttack(state)
        if (defenderMustRetreat) {
            return morale
        }
    }
    if (attack.pending.length === 0) {
        endAttack(state)
    }
    return morale
}

export interface MoraleOutcome {
    loserId?: string
    moraleLost: number
    guardAttackDefeat?: MoralePenalty
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
    state.loseMorale(loserId, moraleLost, attack.artilleryLed === true)
    const guardAttackDefeat =
        !attack.attackerWon && attack.guardAttack && !state.isDemoralized(loserId)
            ? state.failGuardAttack(attack.attackerId)
            : undefined
    return {
        loserId,
        moraleLost,
        guardAttackDefeat,
        demoralizedId: state.isDemoralized(loserId) ? loserId : undefined
    }
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

/** Rule 11, step 11. */
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

export function endAttack(state: HydratedNapoleonsTriumphGameState) {
    assert(currentAttack(state).pending.length === 0, 'Decisions are still waiting')
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
        return
    }
    occupyDefenseLocale(state)
    endAttack(state)
}
