import type { GameAction } from '@tabletop/common'
import {
    DecisionKind,
    MoralePenaltyKind,
    ResultTermKind,
    UnitType,
    isAssignLosses,
    isCounterAttack,
    isDeclareAttack,
    isRetreat,
    isThreatenAttack,
    type Attack,
    type ExcessLossesDecision,
    type Face,
    type LossEntry,
    type MoralePenalty,
    type OddLossDecision,
    type PendingDecision,
    type ResultTerm
} from '@tabletop/napoleons-triumph'

export interface StepLoss {
    unitId: string
    /** The unit as it was before it lost anything in this attack. */
    face: Face
    steps: number
    eliminated: boolean
}

export interface SideLosses {
    playerId: string
    steps: number
    /** Steps the side owes that wait on a player choosing the units to lose them. */
    owed: number
    /** Every point of morale the attack has cost this side so far. */
    morale: number
    taken: StepLoss[]
    /** Morale paid for steps lost, which only the side that lost the fight or retreated pays. */
    paidForSteps: number
    penalties: MoralePenalty[]
}

export interface AttackLosses {
    attacker: SideLosses
    defender: SideLosses
}

type FoughtAttack = Pick<Attack, 'attackerId' | 'defenderId' | 'attackingUnitIds'>

type LossDecision = OddLossDecision | ExcessLossesDecision

function noLosses(playerId: string): SideLosses {
    return { playerId, steps: 0, owed: 0, morale: 0, taken: [], paidForSteps: 0, penalties: [] }
}

function isLossDecision(decision: PendingDecision): decision is LossDecision {
    return decision.kind === DecisionKind.OddLoss || decision.kind === DecisionKind.ExcessLosses
}

/** Rule 11, step 9: the enemy places an odd step, so it is owed by the side whose units it falls between. */
export function ownerOfLoss(attack: FoughtAttack, decision: LossDecision): string {
    if (decision.kind === DecisionKind.ExcessLosses) {
        return decision.playerId
    }
    return attack.attackingUnitIds.includes(decision.unitIds[0])
        ? attack.attackerId
        : attack.defenderId
}

export function stepsOwedBy(decision: LossDecision): number {
    return decision.kind === DecisionKind.OddLoss ? 1 : decision.amount
}

function stepsIn(losses: readonly LossEntry[]): number {
    return losses.reduce((sum, loss) => sum + loss.steps, 0)
}

/** What the attack in progress has cost each side, from what its actions recorded since it was threatened and the losses still waiting on a choice. */
export function lossesOfAttack(
    actions: readonly GameAction[],
    attack: FoughtAttack,
    pending: readonly PendingDecision[]
): AttackLosses {
    const attacker = noLosses(attack.attackerId)
    const defender = noLosses(attack.defenderId)
    const sideOf = (playerId: string) => (playerId === attack.attackerId ? attacker : defender)
    const take = (losses: readonly LossEntry[]) => {
        for (const loss of losses) {
            const side = attack.attackingUnitIds.includes(loss.unitId) ? attacker : defender
            const earlier = side.taken.find((taken) => taken.unitId === loss.unitId)
            if (earlier) {
                earlier.steps += loss.steps
                earlier.eliminated ||= loss.eliminated
            } else {
                side.taken.push({ ...loss, face: { ...loss.face } })
            }
            side.steps += loss.steps
        }
    }
    const pay = (penalties: readonly MoralePenalty[] | undefined) => {
        for (const penalty of penalties ?? []) {
            sideOf(penalty.playerId).penalties.push(penalty)
        }
    }
    const fought = actions.slice(
        Math.max(
            0,
            actions.findLastIndex((action) => isThreatenAttack(action))
        )
    )
    for (const action of fought) {
        if (isRetreat(action) && action.metadata) {
            take(action.metadata.losses)
            pay(action.metadata.penalties)
            defender.paidForSteps += stepsIn(action.metadata.losses)
        } else if (
            (isDeclareAttack(action) || isCounterAttack(action) || isAssignLosses(action)) &&
            action.metadata
        ) {
            take(action.metadata.losses)
            pay(action.metadata.penalties)
            if (action.metadata.loserId !== undefined) {
                sideOf(action.metadata.loserId).paidForSteps += action.metadata.moraleLost ?? 0
            }
        }
    }
    for (const decision of pending.filter(isLossDecision)) {
        sideOf(ownerOfLoss(attack, decision)).owed += stepsOwedBy(decision)
    }
    for (const side of [attacker, defender]) {
        side.morale =
            side.paidForSteps + side.penalties.reduce((sum, penalty) => sum + penalty.moraleLost, 0)
    }
    return { attacker, defender }
}

export function anyLoss(losses: AttackLosses): boolean {
    return [losses.attacker, losses.defender].some(
        (side) => side.steps > 0 || side.owed > 0 || side.morale > 0
    )
}

export function counted(amount: number, one: string): string {
    return `${amount} ${one}${amount === 1 || one === 'morale' ? '' : 's'}`
}

export function lossSummary(side: SideLosses): string {
    const parts = [
        ...(side.steps > 0 ? [counted(side.steps, 'step')] : []),
        ...(side.owed > 0 ? [`${counted(side.owed, 'step')} owed`] : []),
        ...(side.morale > 0 ? [counted(side.morale, 'morale')] : [])
    ]
    if (parts.length < 2) {
        return parts[0] ?? 'no loss'
    }
    return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}

export interface OwedLine {
    text: string
    steps: number
}

interface Led {
    attackLeaders: Face[]
    defenseLeaders: Face[]
    artilleryLed: boolean
}

function ledBy(initial: readonly ResultTerm[]): Led {
    const facesOf = (kind: ResultTermKind) =>
        initial.find((term) => term.kind === kind)?.faces ?? []
    return {
        attackLeaders: facesOf(ResultTermKind.AttackLeaders),
        defenseLeaders: facesOf(ResultTermKind.DefenseLeaders),
        artilleryLed: initial.some((term) => term.kind === ResultTermKind.ArtilleryLeads)
    }
}

/** Rule 11, step 9: the steps the attack owes for its result, line by line. */
export function owedByAttacker(initial: readonly ResultTerm[], finalResult: number): OwedLine[] {
    const { defenseLeaders, artilleryLed } = ledBy(initial)
    if (artilleryLed) {
        return [{ text: 'Artillery leading an attack takes no loss', steps: 0 }]
    }
    return [
        { text: 'A step for each unit leading the defence', steps: defenseLeaders.length },
        ...(finalResult < 0
            ? [
                  {
                      text: 'A step for each point the final result is below zero',
                      steps: -finalResult
                  }
              ]
            : [])
    ]
}

/** Rule 11, steps 7 and 10: the steps the defence owes, line by line; they never come to less than none. */
export function owedByDefender(
    initial: readonly ResultTerm[],
    finalResult: number,
    counterAttackers: number
): OwedLine[] {
    const { attackLeaders, defenseLeaders, artilleryLed } = ledBy(initial)
    const above = Math.max(0, finalResult)
    const guns = defenseLeaders.filter((face) => face.type === UnitType.Artillery).length
    const forTheResult = {
        text: 'A step for each point the final result is above zero',
        steps: above
    }
    const fought = artilleryLed
        ? [forTheResult]
        : [
              { text: 'A step for each unit leading the attack', steps: attackLeaders.length },
              ...(above > 0 ? [forTheResult] : []),
              ...(guns > 0
                  ? [
                        {
                            text: 'Less one for each artillery unit leading the defence',
                            steps: -Math.min(guns, attackLeaders.length + above)
                        }
                    ]
                  : [])
          ]
    return [
        ...(counterAttackers > 0
            ? [{ text: 'A step from each unit that counter-attacks', steps: counterAttackers }]
            : []),
        ...fought
    ]
}

export const PENALTY_NAMES: Record<MoralePenaltyKind, string> = {
    [MoralePenaltyKind.GuardCommitted]: 'Committing the Guard',
    [MoralePenaltyKind.HeavyCavalryCommitted]: 'Committing the heavy cavalry',
    [MoralePenaltyKind.GuardAttackDefeated]: 'The Guard Attack defeated'
}
