import { AnomalyChallenge } from '../components/anomalyCatalog.js'
import { DirectiveAttack, DirectiveProduction, DirectiveType } from '../components/directives.js'
import { OperationRoll } from '../components/titles.js'
import { TradeGood } from '../components/tradeGoods.js'
import { WorldClass } from '../components/worldTypes.js'
import { isCampaign } from './campaign.js'
import { PRODUCTION_TOTALS, checkDirective, usesDirectives } from './directives.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { type FulfilledDirective, emptyTurnRecord } from './pieces.js'

// What each Player does in a campaign turn, kept for the directives that add up over the turn
// (rulebook 5.1) and the titles whose prerequisite must be met this turn (5.2). The record starts
// afresh each turn and is kept whether or not those optional rules are played.

export function startTurnRecord(state: HydratedStellarHorizonsGameState) {
    for (const player of state.players) {
        player.turnRecord = emptyTurnRecord()
    }
}

// What a Player did toward a directive, as each rule reports it.
export type TurnProgress =
    | { kind: DirectiveType.Anomaly; challenge: AnomalyChallenge; difficulty: number }
    | { kind: DirectiveType.Combat; attack: DirectiveAttack; targetId: string }
    | { kind: DirectiveType.Production; production: DirectiveProduction; amount: number }
    | { kind: DirectiveType.Survey; systemId: string }
    | { kind: DirectiveType.Trade; systemId: string; good: TradeGood }
    | { kind: DirectiveType.Terraform; worldClass: WorldClass }

// Kept in the record, then checked against the Player's directive.
export function recordTurnProgress(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    progress: TurnProgress
): FulfilledDirective | undefined {
    if (!isCampaign(state)) {
        return undefined
    }
    const record = state.getPlayerState(playerId).turnRecord
    switch (progress.kind) {
        case DirectiveType.Production:
            record[PRODUCTION_TOTALS[progress.production]] += progress.amount
            break
        case DirectiveType.Trade:
            record.sales.push({ systemId: progress.systemId, good: progress.good })
            break
        case DirectiveType.Terraform:
            record.terraformedClasses.push(progress.worldClass)
            break
        case DirectiveType.Anomaly:
            record.resolvedChallenges.push({
                challenge: progress.challenge,
                difficulty: progress.difficulty
            })
            break
    }
    return usesDirectives(state) ? checkDirective(state, playerId, progress) : undefined
}

// Several things toward a Player's directive at once, such as the goods of one sale or the bases
// of one blockade: the directive is fulfilled by the first that meets it.
export function recordTurnProgresses(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    progresses: readonly TurnProgress[]
): FulfilledDirective[] {
    return progresses.flatMap((progress) => {
        const fulfilled = recordTurnProgress(state, playerId, progress)
        return fulfilled ? [fulfilled] : []
    })
}

// Rulebook 5.2's Guardian and Mastermind count events as well as anomalies; anomaly directives
// count only anomalies, which are recorded through their progress.
export function recordResolvedEvent(
    state: HydratedStellarHorizonsGameState,
    resolverIds: readonly string[],
    challenge: AnomalyChallenge,
    difficulty: number
) {
    if (!isCampaign(state)) {
        return
    }
    for (const playerId of resolverIds) {
        state.getPlayerState(playerId).turnRecord.resolvedChallenges.push({ challenge, difficulty })
    }
}

// Rulebook 5.2's Admiral: attacked, or blockaded (slice 5, Q5), by a Player with more escalation
// markers, before or after the combat.
export function recordAttack(
    state: HydratedStellarHorizonsGameState,
    attackerId: string,
    defenderId: string
) {
    if (
        isCampaign(state) &&
        state.getPlayerState(attackerId).escalation.length >
            state.getPlayerState(defenderId).escalation.length
    ) {
        state.getPlayerState(defenderId).turnRecord.attackedByMoreEscalation = true
    }
}

// Rulebook 5.2's Navigator: how narrowly a malfunction was avoided. With no chance of one there
// is nothing to avoid (campaign plan, slice 6b review).
export function recordMalfunctionRoll(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    roll: number,
    rate: number
) {
    if (!isCampaign(state) || rate === 0 || roll <= rate) {
        return
    }
    const record = state.getPlayerState(playerId).turnRecord
    const margin = roll - rate
    if (record.narrowestMalfunction === undefined || margin < record.narrowestMalfunction) {
        record.narrowestMalfunction = margin
    }
}

// Rulebook 5.2's Prospector and Researcher: a 1 on the mining die used, or the research die.
export function recordOperationRoll(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    operation: OperationRoll,
    roll: number
) {
    const record = state.getPlayerState(playerId).turnRecord
    if (isCampaign(state) && roll === 1 && !record.rolledOne.includes(operation)) {
        record.rolledOne.push(operation)
    }
}
