import {
    isDistributeEarnings,
    isStartOperatingRound,
    isFinishOperatingTurn,
    type OperatingRoundSnapshot,
    type OperatingRoundIdentity,
    type CashPayment
} from '@tabletop/18xx'
import { assertExists, type GameAction } from '@tabletop/common'

export type OperatingRoundHistory = {
    id: string
    complete: boolean
    partial: boolean
    playerIncome: Record<string, number>
    playerNetWorth: Record<string, number>
    companyIncome: Record<string, number>
    companyNames: Record<string, string>
}

export function operatingHistory(actions: readonly GameAction[]): OperatingRoundHistory[] {
    const rounds = new Map<string, OperatingRoundHistory>()
    function roundFor(identity: OperatingRoundIdentity): OperatingRoundHistory {
        const id = `${identity.number}.${identity.roundNumber}`
        let round = rounds.get(id)
        if (!round) {
            round = {
                id,
                complete: false,
                partial: true,
                playerIncome: {},
                playerNetWorth: {},
                companyIncome: {},
                companyNames: {}
            }
            rounds.set(id, round)
        }
        return round
    }
    function recordSnapshot(snapshot: OperatingRoundSnapshot) {
        const round = roundFor(snapshot)
        round.complete = snapshot.complete
        round.playerNetWorth = { ...snapshot.playerNetWorth }
        Object.assign(round.companyNames, snapshot.companyNames)
        return round
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
        if (isStartOperatingRound(action)) {
            assertExists(action.metadata, 'Recorded operating round requires metadata')
            const round = recordSnapshot(action.metadata.snapshot)
            round.partial = false
            recordPayments(round, action.metadata.payments)
        } else if (isDistributeEarnings(action)) {
            assertExists(action.metadata, 'Recorded earnings require metadata')
            if (!action.metadata.round) continue
            const round = roundFor(action.metadata.round)
            round.companyNames[action.companyId] = action.metadata.companyName
            round.companyIncome[action.companyId] =
                (round.companyIncome[action.companyId] ?? 0) + action.metadata.revenue
            recordPayments(round, action.metadata.payments)
        } else if (isFinishOperatingTurn(action)) {
            assertExists(action.metadata, 'Recorded operating turn requires a snapshot')
            recordSnapshot(action.metadata)
        }
    }
    return [...rounds.values()]
}
