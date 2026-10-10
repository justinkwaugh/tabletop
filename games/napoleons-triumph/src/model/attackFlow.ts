import { assert, assertExists } from '@tabletop/common'
import { UnitType, isGuard, sameFace } from '../components/pieces.js'
import {
    AttackStep,
    DecisionKind,
    type MoveOrder,
    type PendingDecision
} from './attack.js'
import {
    canThreaten,
    hasUsableCommand,
    resolveAttackOrders,
    type AttackOrders
} from './attackOrders.js'
import {
    attackerLossPoints,
    attackerWins,
    counterAttackStrength,
    defenderLossPoints,
    initialResult,
    isArtilleryLed,
    splitEvenly
} from './combat.js'
import { VictoryKind, type HydratedNapoleonsTriumphGameState, type LossRecord } from './gameState.js'
import { declareVictory } from './victory.js'
import {
    santonBatteryPresent,
    validateAttackLeaders,
    validateCounterAttackers,
    validateDefenseLeaders
} from './leaders.js'
import { relocate } from './movement.js'
import { expendOrder, movingCommander } from './orders.js'
import { SANTON_LOCALE } from '../components/austerlitz.js'
import {
    faceOf,
    inReserve,
    samePosition,
    type Commander,
    type Position,
    type ProjectedUnit
} from './pieces.js'

type AttackState = NonNullable<HydratedNapoleonsTriumphGameState['attack']>

export function currentAttack(state: HydratedNapoleonsTriumphGameState): AttackState {
    assertExists(state.attack, 'No attack is in progress')
    return state.attack
}

export function attackLocale(state: HydratedNapoleonsTriumphGameState, attack: AttackState): number {
    return state.map.approach(attack.attackApproach).locale
}

export function defenseLocale(state: HydratedNapoleonsTriumphGameState, attack: AttackState): number {
    return state.map.approach(attack.defenseApproach).locale
}

function defensePosition(state: HydratedNapoleonsTriumphGameState, attack: AttackState): Position {
    return { locale: defenseLocale(state, attack), approach: attack.defenseApproach }
}

/** Rule 11, step 1. */
export function threatenAttack(
    state: HydratedNapoleonsTriumphGameState,
    attackerId: string,
    attackApproach: number,
    guardUnitId?: string
) {
    assert(state.attack === undefined, 'An attack is already in progress')
    assert(!state.currentRound.night, 'There are no attacks at night')
    const approach = state.map.approach(attackApproach)
    assert(!approach.impassable, 'An impassable approach cannot be attacked across')
    assert(
        state.isEnemyOccupied(approach.neighbour, attackerId),
        'An attack is a move into an enemy-occupied locale'
    )
    assert(
        !state.limits.closedApproaches.includes(attackApproach),
        'No further attack may cross that approach this turn'
    )
    assert(canThreaten(state, attackerId, attackApproach), 'No piece could attack across that approach')
    const defenderId = state.opponentOf(attackerId).playerId
    if (guardUnitId !== undefined) {
        const guard = state.unit(guardUnitId)
        const stance = guard.position
        assert(guard.playerId === attackerId && isGuard(faceOf(guard)), 'A Guard Attack needs Guard infantry')
        assert(
            samePosition(stance, { locale: approach.locale }) ||
                samePosition(stance, { locale: approach.locale, approach: attackApproach }),
            'The Guard must be able to make the attack'
        )
        assert(!approach.obstructed, 'A Guard Attack cannot cross an obstructed approach')
        assert(
            !state.getPlayerState(attackerId).guardAttackForfeited,
            'This army may no longer declare Guard Attacks'
        )
        state.reveal(guard)
    }
    state.attack = {
        step: AttackStep.DefenseResponse,
        attackerId,
        defenderId,
        attackApproach,
        defenseApproach: approach.opposite,
        guardAttack: guardUnitId === undefined ? undefined : true,
        defendingUnitIds: [],
        defendingCommanderIds: [],
        defenseLeaderIds: [],
        orders: [],
        attackingUnitIds: [],
        attackingCommanderIds: [],
        attackLeaderIds: [],
        counterAttackerIds: [],
        attackerStepsLost: 0,
        defenderStepsLost: 0,
        pending: []
    }
}

/** Pieces blocking the defense approach must fight; otherwise the defender may give ground. */
export function mustDefend(state: HydratedNapoleonsTriumphGameState): boolean {
    const attack = currentAttack(state)
    return state.blockers(attack.defenseApproach, attack.defenderId).length > 0
}

export function eligibleReserveDefenders(
    state: HydratedNapoleonsTriumphGameState
): ProjectedUnit[] {
    const attack = currentAttack(state)
    return state
        .reserveUnits(defenseLocale(state, attack), attack.defenderId)
        .filter(
            (unit) =>
                !unit.retreatedAfterCombat &&
                (unit.defendedApproach === undefined ||
                    unit.defendedApproach === attack.defenseApproach)
        )
}

/** Rule 11, steps 2 and 4: the defending pieces, and the leading units held back until step 4. */
export function declareDefense(
    state: HydratedNapoleonsTriumphGameState,
    unitIds: readonly string[],
    leaderIds: readonly string[]
) {
    const attack = currentAttack(state)
    assert(unitIds.length > 0, 'A defense names at least one unit')
    assert(new Set(unitIds).size === unitIds.length, 'A defending unit is named once')
    const units = unitIds.map((id) => state.unit(id))
    const blockers = state.blockers(attack.defenseApproach, attack.defenderId)
    const blocking = blockers.length > 0
    if (blocking) {
        assert(
            blockers.length === units.length && blockers.every((unit) => unitIds.includes(unit.id)),
            'Every piece blocking the defense approach defends, and no other'
        )
    } else {
        const eligible = eligibleReserveDefenders(state)
        assert(
            units.every((unit) => eligible.includes(unit)),
            'Defending pieces come from the reserve and must still be free to defend'
        )
        assert(
            units.filter((unit) => unit.commanderId === undefined).length <= 1,
            'At most one detached unit defends from reserve'
        )
    }
    assert(leaderIds.every((id) => unitIds.includes(id)), 'Leading units are defending pieces')
    assert(new Set(leaderIds).size === leaderIds.length, 'A leading unit is named once')
    validateDefenseLeaders(
        state,
        leaderIds.map((id) => state.unit(id)),
        attack.defenseApproach,
        blocking
    )
    attack.defendingUnitIds = [...unitIds]
    attack.defendingCommanderIds = [
        ...new Set(units.flatMap((unit) => (unit.commanderId ? [unit.commanderId] : [])))
    ]
    attack.defendersBlocking = blocking
    attack.defensePlan = { playerId: attack.defenderId, leaderIds: [...leaderIds] }
    for (const unit of units) {
        unit.defendedApproach = attack.defenseApproach
    }
    attack.step = AttackStep.FeintDecision
    if (attack.guardAttack) {
        revealDefenseLeaders(state)
    }
}

/** Whether the attacker has pieces in place for a real attack; one arriving by road can only feint. */
export function canPressAttack(state: HydratedNapoleonsTriumphGameState): boolean {
    const attack = currentAttack(state)
    const locale = attackLocale(state, attack)
    return [
        ...state.reserveUnits(locale, attack.attackerId),
        ...state.blockers(attack.attackApproach, attack.attackerId)
    ].some((unit) => hasUsableCommand(state, unit))
}

/** Rule 11, step 4 made public once the attacker presses on. */
export function revealDefenseLeaders(state: HydratedNapoleonsTriumphGameState) {
    const attack = currentAttack(state)
    assertExists(attack.defensePlan, 'The defense has not been declared')
    const leaderIds = attack.defensePlan.leaderIds
    assertExists(leaderIds, 'The defense leading units are not known here')
    attack.defenseLeaderIds = [...leaderIds]
    attack.defensePlan = undefined
    for (const id of leaderIds) {
        const unit = state.unit(id)
        state.reveal(unit)
        state.commit(unit)
    }
    attack.step = AttackStep.AttackDeclaration
}

function recordAttackers(attack: AttackState, orders: readonly MoveOrder[], resolved: AttackOrders) {
    attack.orders = orders.map((order) => ({ ...order }))
    attack.attackingUnitIds = resolved.units.map((unit) => unit.id)
    attack.attackingCommanderIds = resolved.resolved.flatMap((entry) => {
        const commander = movingCommander(entry)
        return commander ? [commander.id] : []
    })
}

function closeApproach(state: HydratedNapoleonsTriumphGameState, attack: AttackState) {
    if (!state.limits.closedApproaches.includes(attack.attackApproach)) {
        state.limits.closedApproaches.push(attack.attackApproach)
    }
}

function queueAdvance(state: HydratedNapoleonsTriumphGameState, attack: AttackState) {
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
    const locale = attackLocale(state, attack)
    const blocking: Position = { locale, approach: attack.attackApproach }
    const startsBlocking = samePosition(resolved.stance, blocking) && !resolved.road
    assert(
        !startsBlocking || end === FeintEnd.Approach,
        'Pieces feinting from the attack approach stay on it'
    )
    const to = end === FeintEnd.Approach ? blocking : { locale }
    assert(
        state.freeCapacity(locale, attack.attackerId, resolved.road ? [] : resolved.units.map((unit) => unit.id)) >=
            resolved.units.length,
        'The attack locale cannot hold those units'
    )
    recordAttackers(attack, orders, resolved)
    attack.feint = true
    for (const entry of resolved.resolved) {
        relocate(state, entry, to, entry.order.road)
        expendOrder(state, entry)
    }
    if (resolved.road) {
        state.revealAll(resolved.units)
    }
    closeApproach(state, attack)
    queueAdvance(state, attack)
    concludeAttack(state)
}

export interface AttackDeclaration {
    orders: readonly MoveOrder[]
    wide: boolean
    leaderIds: readonly string[]
    /** With a narrow attack against two defense leaders, the one that is attacked. */
    targetLeaderId?: string
}

function artilleryMayFire(state: HydratedNapoleonsTriumphGameState, attack: AttackState): boolean {
    if (state.limits.bombardedApproaches.includes(attack.attackApproach)) {
        return false
    }
    const lastFired = state.artilleryFire[String(attack.attackApproach)]
    if (lastFired === undefined || lastFired !== state.round - 1) {
        return true
    }
    const fromHill = state.map.locale(attackLocale(state, attack)).hill
    const ontoHill = state.map.locale(defenseLocale(state, attack)).hill
    return fromHill && !ontoHill
}

/** Rule 11, steps 5 and 6. Resolves the attack outright when no counter-attack is possible. */
export function declareAttack(
    state: HydratedNapoleonsTriumphGameState,
    declaration: AttackDeclaration
): CombatOutcome | undefined {
    const attack = currentAttack(state)
    const resolved = resolveAttackOrders(state, attack, declaration.orders)
    assert(!resolved.road, 'An attack by road must be a feint')
    const attackApproach = state.map.approach(attack.attackApproach)
    assert(!declaration.wide || attackApproach.wide, 'A narrow approach allows only a narrow attack')
    assert(
        resolved.units.length <= state.map.locale(defenseLocale(state, attack)).capacity,
        'The defense locale could not hold the attacking units'
    )
    assert(
        declaration.leaderIds.every((id) => resolved.units.some((unit) => unit.id === id)),
        'Leading units are attacking pieces'
    )
    assert(new Set(declaration.leaderIds).size === declaration.leaderIds.length, 'A leading unit is named once')
    const leaders = declaration.leaderIds.map((id) => state.unit(id))
    const attackersBlocking = resolved.stance.approach !== undefined
    validateAttackLeaders(state, leaders, {
        attackApproach: attack.attackApproach,
        wide: declaration.wide,
        guardAttack: attack.guardAttack === true,
        attackersBlocking,
        orders: resolved.resolved
    })
    const artilleryLed = isArtilleryLed(leaders.map(faceOf))
    assert(!artilleryLed || artilleryMayFire(state, attack), 'Artillery may not lead an attack here now')
    assert(
        !resolved.artilleryPair || (artilleryLed && leaders.length === 2),
        'Two batteries combine only to lead an attack together'
    )

    if (!declaration.wide && attack.defenseLeaderIds.length === 2) {
        assert(
            declaration.targetLeaderId !== undefined &&
                attack.defenseLeaderIds.includes(declaration.targetLeaderId),
            'A narrow attack names the defense leading unit it strikes'
        )
        attack.defenseLeaderIds = [declaration.targetLeaderId]
    }
    recordAttackers(attack, declaration.orders, resolved)
    attack.wide = declaration.wide
    attack.attackLeaderIds = [...declaration.leaderIds]
    attack.artilleryLed = artilleryLed
    for (const entry of resolved.resolved) {
        expendOrder(state, entry)
    }
    for (const unit of leaders) {
        state.reveal(unit)
        state.commit(unit)
    }
    const defenseApproach = state.map.approach(attack.defenseApproach)
    attack.initialResult = initialResult({
        attackLeaders: leaders.map(faceOf),
        defenseLeaders: attack.defenseLeaderIds.map((id) => faceOf(state.unit(id))),
        defendersBlocking: attack.defendersBlocking === true,
        approachPenalties: defenseApproach.penalties,
        penaltiesApplyInReserve:
            defenseApproach.locale === SANTON_LOCALE && santonBatteryPresent(state),
        guardAttack: attack.guardAttack === true
    })
    if (counterAttackCandidates(state).length > 0) {
        attack.step = AttackStep.CounterAttackDecision
        return undefined
    }
    return resolveCombat(state, [])
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

/** Defending units that are not leading; only they could counter-attack. */
export function counterAttackCandidates(state: HydratedNapoleonsTriumphGameState): ProjectedUnit[] {
    const attack = currentAttack(state)
    if (attack.artilleryLed) {
        return []
    }
    return attack.defendingUnitIds
        .filter((id) => !attack.defenseLeaderIds.includes(id))
        .flatMap((id) => state.findUnit(id) ?? [])
}

function recordLoss(attack: AttackState, playerId: string, loss: LossRecord) {
    if (playerId === attack.attackerId) {
        attack.attackerStepsLost += loss.steps
    } else {
        attack.defenderStepsLost += loss.steps
    }
}

function lose(
    state: HydratedNapoleonsTriumphGameState,
    attack: AttackState,
    unit: ProjectedUnit,
    steps: number
): LossRecord {
    state.reveal(unit)
    const loss = state.takeLoss(unit, steps)
    recordLoss(attack, unit.playerId, loss)
    return loss
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
    assert(units.every((unit) => candidates.includes(unit)), 'Only defending units that are not leading counter-attack')
    validateCounterAttackers(state, units, attack.defenseApproach, attackerLeadsInitially(state))
    const faces = units.map(faceOf)
    attack.counterAttackerIds = [...unitIds]
    attack.finalResult = attack.initialResult - counterAttackStrength(faces)
    for (const unit of units) {
        state.commit(unit)
    }
    return resolveCombat(
        state,
        units.map((unit) => lose(state, attack, unit, 1))
    )
}

function living(state: HydratedNapoleonsTriumphGameState, ids: readonly string[]): ProjectedUnit[] {
    return ids.flatMap((id) => state.findUnit(id) ?? [])
}

/**
 * Applies a loss spread evenly over a group of one or two revealed units. Returns the steps the
 * group could not absorb.
 */
function loseEvenly(
    state: HydratedNapoleonsTriumphGameState,
    attack: AttackState,
    units: readonly ProjectedUnit[],
    losses: number,
    chooserId: string,
    records: LossRecord[]
): number {
    if (units.length === 0 || losses <= 0) {
        return Math.max(0, losses)
    }
    const split = splitEvenly(units.map((unit) => faceOf(unit).strength), losses)
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
    records: LossRecord[]
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
    losses: LossRecord[]
    morale?: MoraleOutcome
    finalResult?: number
    attackerWon?: boolean
}

/** Rule 11, steps 8 to 10: the final result and every loss that needs no choice. */
function resolveCombat(
    state: HydratedNapoleonsTriumphGameState,
    records: LossRecord[]
): CombatOutcome {
    const attack = currentAttack(state)
    assertExists(attack.initialResult, 'The attack has not been declared')
    const final = attack.finalResult ?? attack.initialResult
    attack.finalResult = final
    attack.attackerWon = attackerWins(final, tiebreak(state, attack))
    attack.step = AttackStep.Resolving

    const attackLeaders = living(state, attack.attackLeaderIds)
    const attackLeaderFaces = attackLeaders.map(faceOf)
    const defenseLeaders = living(state, attack.defenseLeaderIds)
    const defenseLeaderFaces = defenseLeaders.map(faceOf)

    const attackerLoss = attackerLossPoints(attackLeaderFaces, defenseLeaders.length, final)
    const defenderLoss = defenderLossPoints(attackLeaderFaces, defenseLeaderFaces, final)

    const attackerExcess = loseEvenly(state, attack, attackLeaders, attackerLoss, attack.defenderId, records)
    queueExcess(
        state,
        attack,
        attack.attackerId,
        living(state, attack.attackingUnitIds).filter((unit) => !attack.attackLeaderIds.includes(unit.id)),
        attackerExcess,
        records
    )

    const fightingLeaders = defenseLeaders.filter((unit) => faceOf(unit).type !== UnitType.Artillery)
    const afterLeaders = loseEvenly(state, attack, fightingLeaders, defenderLoss, attack.attackerId, records)
    const counterAttackers = living(state, attack.counterAttackerIds)
    const afterCounterAttackers = loseEvenly(state, attack, counterAttackers, afterLeaders, attack.attackerId, records)
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

/**
 * Carries the attack as far as it can go without another choice: settles morale once every loss
 * is assigned, completes the attack, and ends it when nothing is left to decide.
 */
export function concludeAttack(state: HydratedNapoleonsTriumphGameState): MoraleOutcome | undefined {
    const attack = currentAttack(state)
    let morale: MoraleOutcome | undefined
    const fought = !attack.feint && !attack.retreatBeforeCombat
    if (fought && !attack.lossesSettled) {
        if (attack.pending.some(isLossDecision)) {
            return undefined
        }
        morale = settleLosses(state)
        if (morale.demoralizedId !== undefined) {
            declareVictory(state, state.opponentOf(morale.demoralizedId).playerId, VictoryKind.Decisive)
            state.attack = undefined
            return morale
        }
        if (completeAttack(state) === Completion.DefenderRetreats) {
            attack.step = AttackStep.Retreating
            return morale
        }
    }
    if (attack.pending.length > 0) {
        attack.step = AttackStep.Resolving
        return morale
    }
    endAttack(state)
    return morale
}

export function nextDecision(state: HydratedNapoleonsTriumphGameState): PendingDecision | undefined {
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
        entries.every(([id, steps]) => Number.isInteger(steps) && steps <= faceOf(state.unit(id)).strength),
        'A unit cannot lose more steps than it has'
    )
    const total = entries.reduce((sum, [, steps]) => sum + steps, 0)
    assert(total === decision.amount, `Exactly ${decision.amount} steps must be assigned`)
    const losses = entries.map(([id, steps]) => lose(state, currentAttack(state), state.unit(id), steps))
    return { losses, morale: concludeAttack(state) }
}

export interface MoraleOutcome {
    loserId?: string
    moraleLost: number
    demoralizedId?: string
}

/** Rule 13: the loser pays morale for the strength it lost; a failed Guard Attack costs more. */
function settleLosses(state: HydratedNapoleonsTriumphGameState): MoraleOutcome {
    const attack = currentAttack(state)
    assert(attack.pending.every((decision) => decision.kind !== DecisionKind.OddLoss && decision.kind !== DecisionKind.ExcessLosses), 'Losses are still being assigned')
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

enum Completion {
    Finished = 'Finished',
    AwaitingDecisions = 'AwaitingDecisions',
    DefenderRetreats = 'DefenderRetreats'
}

function attackingPieces(state: HydratedNapoleonsTriumphGameState, attack: AttackState): (ProjectedUnit | Commander)[] {
    return [
        ...living(state, attack.attackingUnitIds),
        ...attack.attackingCommanderIds
            .map((id) => state.commander(id))
            .filter((commander) => !commander.eliminated)
    ]
}

/** Moves the victorious attackers into the reserve of the locale they took. */
export function occupyDefenseLocale(state: HydratedNapoleonsTriumphGameState) {
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
        attack.pending.push({ kind: DecisionKind.Regroup, playerId: attack.attackerId, commanderIds: choices })
    }
    queueAdvance(state, attack)
}

/** Rule 11, step 11. Call once losses are settled. */
function completeAttack(state: HydratedNapoleonsTriumphGameState): Completion {
    const attack = currentAttack(state)
    if (attack.artilleryLed) {
        state.artilleryFire[String(attack.attackApproach)] = state.round
        if (!state.limits.bombardedApproaches.includes(attack.attackApproach)) {
            state.limits.bombardedApproaches.push(attack.attackApproach)
        }
        return Completion.Finished
    }
    if (attack.attackerWon) {
        const locale = defenseLocale(state, attack)
        state.limits.stormedLocales.push(locale)
        if (state.piecesOnMap(attack.defenderId).some((piece) => piece.position?.locale === locale)) {
            return Completion.DefenderRetreats
        }
        occupyDefenseLocale(state)
        return Completion.Finished
    }
    repulse(state, attack)
    return attack.pending.length > 0 ? Completion.AwaitingDecisions : Completion.Finished
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
        const corps = living(state, attack.attackingUnitIds).filter((unit) => unit.commanderId === commanderId)
        const kept = keep[commanderId]
        assert(corps.some((unit) => unit.id === kept), `Name the unit that stays with ${commanderId}`)
        for (const unit of corps) {
            if (unit.id !== kept) {
                state.detach(unit)
            }
        }
    }
    concludeAttack(state)
}

/** A defender in reserve that held, or was feinted against, steps up to the approach. */
export function advance(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    unitIds: readonly string[],
    commanderIds: readonly string[]
) {
    const attack = currentAttack(state)
    const decision = takeDecision(state, DecisionKind.Advance, playerId)
    assert(unitIds.length > 0, 'At least one unit must advance to the approach')
    assert(unitIds.every((id) => decision.unitIds.includes(id)), 'Only defending pieces advance')
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
    state.place([...units, ...commanders], position)
    for (const commanderId of new Set(state.unitsIn(position.locale, playerId).flatMap((unit) => unit.commanderId ?? []))) {
        const commander = state.commander(commanderId)
        for (const unit of state.corpsUnits(commanderId)) {
            if (!samePosition(unit.position, commander.position)) {
                state.detach(unit)
            }
        }
    }
    concludeAttack(state)
}

/** Without a repulse to regroup from, each attacking corps keeps the unit the engine picks by default. */
function endAttack(state: HydratedNapoleonsTriumphGameState) {
    const attack = currentAttack(state)
    assert(attack.pending.length === 0, 'Decisions are still waiting')
    if (!attack.attackerWon && !attack.artilleryLed && !attack.feint && !attack.retreatBeforeCombat) {
        for (const commanderId of attack.attackingCommanderIds) {
            const corps = living(state, attack.attackingUnitIds).filter((unit) => unit.commanderId === commanderId)
            corps.slice(1).forEach((unit) => state.detach(unit))
        }
    }
    state.attack = undefined
}

export function defendersInReserve(state: HydratedNapoleonsTriumphGameState): boolean {
    const attack = currentAttack(state)
    return attack.defendersBlocking === false
}

export function isInDefenseReserve(state: HydratedNapoleonsTriumphGameState, unit: ProjectedUnit): boolean {
    const attack = currentAttack(state)
    return unit.position !== undefined && unit.position.locale === defenseLocale(state, attack) && inReserve(unit.position)
}

/** What follows the defender's retreat: the attackers take the locale, at once or by their declaration. */
export function afterRetreat(state: HydratedNapoleonsTriumphGameState, demoralized: boolean) {
    const attack = currentAttack(state)
    if (demoralized) {
        declareVictory(state, attack.attackerId, VictoryKind.Decisive)
        state.attack = undefined
        return
    }
    if (attack.retreatBeforeCombat) {
        attack.step = AttackStep.Occupying
        return
    }
    occupyDefenseLocale(state)
    endAttack(state)
}

export function finishOccupation(state: HydratedNapoleonsTriumphGameState) {
    endAttack(state)
}
