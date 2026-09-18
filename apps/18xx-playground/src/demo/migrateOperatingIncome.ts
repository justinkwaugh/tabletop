import {
    assert,
    ExplorationHistory,
    type GameAction,
    type GameEngine,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    FinanceExampleValidator,
    isDistributeEarnings,
    isFinishOperatingTurn,
    isStartOperatingRound,
    operatingRoundSnapshot,
    getCompany,
    type ValuationRules
} from '@tabletop/18xx'

export function migrateOperatingIncome(
    state: GameState,
    actions: GameAction[],
    engine: GameEngine<GameState, HydratedGameState>,
    rules: ValuationRules
): boolean {
    const needsSnapshot = (action: GameAction) =>
        (action.type === 'StartOperatingRound' && !isStartOperatingRound(action)) ||
        (action.type === 'DistributeEarnings' && !isDistributeEarnings(action)) ||
        (action.type === 'FinishOperatingTurn' &&
            (!isFinishOperatingTurn(action) || !action.metadata))
    if (!actions.some(needsSnapshot)) return false
    const history = new ExplorationHistory(engine)
    let cursor = state
    for (const action of actions.toReversed()) {
        if (needsSnapshot(action)) {
            assert(
                FinanceExampleValidator.Check(cursor),
                'Local income migration requires finance state'
            )
            if (action.type === 'FinishOperatingTurn') {
                Reflect.set(action, 'metadata', operatingRoundSnapshot(cursor, rules))
            } else {
                const metadata: unknown = Reflect.get(action, 'metadata')
                assert(
                    metadata && typeof metadata === 'object',
                    'Recorded income action requires metadata'
                )
                if (action.type === 'StartOperatingRound') {
                    Reflect.set(metadata, 'snapshot', operatingRoundSnapshot(cursor, rules))
                } else {
                    const companyId: unknown = Reflect.get(action, 'companyId')
                    assert(typeof companyId === 'string', 'Distribution requires a company')
                    Reflect.set(metadata, 'companyName', getCompany(cursor, companyId).name)
                    if (cursor.operatingSet)
                        Reflect.set(metadata, 'round', {
                            number: cursor.operatingSet.number,
                            roundNumber: cursor.operatingSet.roundNumber
                        })
                }
            }
        }
        cursor = history.backward(cursor, action, state.explorationState)
    }
    return true
}
