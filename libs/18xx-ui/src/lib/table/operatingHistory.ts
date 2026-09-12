import {
    FinanceExampleValidator,
    isDistributeEarnings,
    isStartOperatingRound,
    nextOperatingCompany,
    portfolioWealth,
    type ValuationRules
} from '@tabletop/18xx'
import {
    assert,
    assertExists,
    ExplorationHistory,
    type GameAction,
    type GameEngine,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'

export type OperatingRoundHistory = {
    id: string
    complete: boolean
    partial: boolean
    playerIncome: Record<string, number>
    playerNetWorth: Record<string, number>
    companyIncome: Record<string, number>
    companyNames: Record<string, string>
}

export function operatingHistory(
    state: GameState,
    actions: readonly GameAction[],
    engine: GameEngine<GameState, HydratedGameState>,
    valuationRules: ValuationRules
): OperatingRoundHistory[] {
    const rounds = new Map<string, OperatingRoundHistory>()
    const history = new ExplorationHistory(engine)
    const exploration = state.explorationState
    let cursor = state
    for (const action of actions.toReversed()) {
        assert(
            FinanceExampleValidator.Check(cursor),
            'Operating history requires financial game state'
        )
        const snapshot = cursor
        const set = snapshot.operatingSet
        if (
            set?.privateIncomePaid &&
            cursor.stockRound.completed &&
            (!set.completed || cursor.result)
        ) {
            const id = `${set.number}.${set.roundNumber}`
            let round = rounds.get(id)
            if (!round) {
                round = {
                    id,
                    complete: !nextOperatingCompany(cursor),
                    partial: true,
                    playerIncome: Object.fromEntries(
                        cursor.players.map((player) => [player.playerId, 0])
                    ),
                    playerNetWorth: Object.fromEntries(
                        cursor.players.map((player) => [
                            player.playerId,
                            portfolioWealth(
                                snapshot,
                                { kind: 'player', playerId: player.playerId },
                                valuationRules
                            ).reduce((sum, item) => sum + item.value, 0)
                        ])
                    ),
                    companyIncome: {},
                    companyNames: Object.fromEntries(
                        cursor.companies
                            .filter((company) => set.companyOrder.includes(company.id))
                            .map((company) => [company.id, company.name])
                    )
                }
                rounds.set(id, round)
            }
            if (isStartOperatingRound(action)) {
                assertExists(action.metadata, 'Recorded operating round requires payment metadata')
                round.partial = false
                for (const payment of action.metadata.payments) {
                    if (payment.to.kind === 'player')
                        round.playerIncome[payment.to.playerId] += payment.amount
                }
            }
            if (isDistributeEarnings(action)) {
                assertExists(action.metadata, 'Recorded earnings require payment metadata')
                round.companyIncome[action.companyId] =
                    (round.companyIncome[action.companyId] ?? 0) + action.metadata.revenue
                for (const payment of action.metadata.payments) {
                    if (payment.to.kind === 'player')
                        round.playerIncome[payment.to.playerId] += payment.amount
                }
            }
        }
        cursor = history.backward(cursor, action, exploration)
    }
    return [...rounds.values()].reverse()
}
