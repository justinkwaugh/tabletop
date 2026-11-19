import {
    isDistributeEarnings,
    isInterruptOperatingTurn,
    isResumeOperatingTurn,
    isRunTrains,
    type RunTrains,
    isStartOperatingRound,
    isFinishOperatingTurn,
    type OperatingRoundSnapshot,
    type OperatingRoundIdentity,
    type CashPayment,
    type PlayerNetWorth,
    type RoundEnd
} from '@tabletop/18xx'
import { assertExists, type GameAction } from '@tabletop/common'
import { identifiedOperatingRoundHeading, roundLabel } from './roundHeading.js'
import { RoundProgress, type RoundProgressTitle } from './roundProgress.js'

export type OperatingRoundHistory = {
    kind: 'operating'
    label: string
    complete: boolean
    partial: boolean
    playerIncome: Record<string, number>
    playerNetWorth: PlayerNetWorth
    companyIncome: Record<string, number>
    companyIds: string[]
    companyRuns: Record<string, RunTrains>
    withheldCompanyIds: string[]
}

/** A round that pays no income: the opening, a stock round or a round of the title's own. */
export type RoundWithoutIncomeHistory = {
    kind: Exclude<RoundEnd['round'], 'operating'>
    label: string
    playerNetWorth?: PlayerNetWorth
}

export type RoundIncomeHistory = OperatingRoundHistory | RoundWithoutIncomeHistory

type CurrentOperatingRound = { round: OperatingRoundHistory; identity: OperatingRoundIdentity }

/**
 * Every operating round and every other round once it has ended, oldest first, with what
 * players were paid in it and their net worth at its end. Only operating rounds pay income.
 */
export function roundIncomeHistory(
    actions: readonly GameAction[],
    title: RoundProgressTitle
): RoundIncomeHistory[] {
    const runs = new Map<string, RunTrains>()
    const history: RoundIncomeHistory[] = []
    const rounds = new RoundProgress(title)
    let current: CurrentOperatingRound | undefined
    function startRound(
        identity: OperatingRoundIdentity,
        label: string,
        partial: boolean
    ): OperatingRoundHistory {
        const round: OperatingRoundHistory = {
            kind: 'operating',
            label,
            complete: false,
            partial,
            playerIncome: {},
            playerNetWorth: {},
            companyIncome: {},
            companyIds: [],
            companyRuns: {},
            withheldCompanyIds: []
        }
        history.push(round)
        current = { round, identity }
        return round
    }
    function roundFor(identity: OperatingRoundIdentity): OperatingRoundHistory {
        return current &&
            current.identity.number === identity.number &&
            current.identity.roundNumber === identity.roundNumber
            ? current.round
            : startRound(identity, roundLabel(identifiedOperatingRoundHeading(identity, 1)), true)
    }
    function addCompany(round: OperatingRoundHistory, companyId: string) {
        if (!round.companyIds.includes(companyId)) round.companyIds.push(companyId)
    }
    function recordSnapshot(round: OperatingRoundHistory, snapshot: OperatingRoundSnapshot) {
        round.complete = snapshot.complete
        round.playerNetWorth = { ...snapshot.playerNetWorth }
        for (const companyId of snapshot.companyIds) addCompany(round, companyId)
    }
    function recordPayments(round: OperatingRoundHistory, payments: CashPayment[]) {
        for (const payment of payments) {
            if (payment.to.kind === 'player') {
                const id = payment.to.playerId
                round.playerIncome[id] = (round.playerIncome[id] ?? 0) + payment.amount
            }
        }
    }
    for (const action of actions) {
        for (const { round, heading, playerNetWorth } of rounds.advance(action)) {
            if (round !== 'operating')
                history.push({
                    kind: round,
                    label: roundLabel(heading),
                    ...(playerNetWorth ? { playerNetWorth: { ...playerNetWorth } } : {})
                })
        }
        if (isRunTrains(action)) {
            runs.set(action.companyId, action)
        } else if (isStartOperatingRound(action)) {
            runs.clear()
            assertExists(action.metadata, 'Recorded operating round requires metadata')
            const { snapshot, payments } = action.metadata
            const round = startRound(snapshot, roundLabel(rounds.current), false)
            recordSnapshot(round, snapshot)
            recordPayments(round, payments)
        } else if (isInterruptOperatingTurn(action)) {
            assertExists(current, 'An interrupted operating turn belongs to an operating round')
            current.round.complete = true
        } else if (isResumeOperatingTurn(action)) {
            assertExists(current, 'A resumed operating turn belongs to an operating round')
            startRound(current.identity, roundLabel(rounds.current), false)
        } else if (isDistributeEarnings(action)) {
            assertExists(action.metadata, 'Recorded earnings require metadata')
            if (!action.metadata.round) continue
            const round = roundFor(action.metadata.round)
            addCompany(round, action.companyId)
            round.companyIncome[action.companyId] =
                (round.companyIncome[action.companyId] ?? 0) + action.metadata.revenue
            const run = runs.get(action.companyId)
            if (run) round.companyRuns[action.companyId] = run
            if (action.choice === 'withhold') round.withheldCompanyIds.push(action.companyId)
            recordPayments(round, action.metadata.payments)
        } else if (isFinishOperatingTurn(action)) {
            assertExists(action.metadata, 'Recorded operating turn requires a snapshot')
            recordSnapshot(roundFor(action.metadata), action.metadata)
            runs.delete(action.companyId)
        }
    }
    return history
}

export function isOperatingRoundHistory(round: RoundIncomeHistory): round is OperatingRoundHistory {
    return round.kind === 'operating'
}

export function playerIncome(round: RoundIncomeHistory, playerId: string): number {
    return isOperatingRoundHistory(round) ? (round.playerIncome[playerId] ?? 0) : 0
}

export function playerNetWorth(round: RoundIncomeHistory, playerId: string): number | undefined {
    return round.playerNetWorth?.[playerId]
}

/** Whether an operating round is still under way or was only partly recorded. */
export function incompleteRound(round: RoundIncomeHistory): boolean {
    return isOperatingRoundHistory(round) && (!round.complete || round.partial)
}

/** A player's net worth change from the latest earlier round that recorded theirs. */
export function netWorthChange(
    history: readonly RoundIncomeHistory[],
    index: number,
    playerId: string
): number | undefined {
    const netWorth = playerNetWorth(history[index], playerId)
    const previous = history
        .slice(0, index)
        .map((round) => playerNetWorth(round, playerId))
        .findLast((value) => value !== undefined)
    return netWorth === undefined || previous === undefined ? undefined : netWorth - previous
}
