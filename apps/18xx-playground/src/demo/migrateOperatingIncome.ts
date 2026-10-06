import {
    assert,
    ExplorationHistory,
    type GameAction,
    type GameEngine,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    isDistributeEarnings,
    isFinishOperatingTurn,
    isStartOperatingRound,
    operatingRoundSnapshot,
    getCompany,
    type ValuationRules,
    type HydratedEighteenXXState
} from '@tabletop/18xx'

export function migrateOperatingIncome<
    Raw extends GameState,
    State extends HydratedGameState<Raw> & HydratedEighteenXXState
>(
    state: Raw,
    actions: GameAction[],
    engine: GameEngine<Raw, State>,
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
            const incomeState = engine.runtime.hydrator.hydrateState(cursor)
            if (action.type === 'FinishOperatingTurn') {
                Reflect.set(action, 'metadata', operatingRoundSnapshot(incomeState, rules))
            } else {
                const metadata: unknown = Reflect.get(action, 'metadata')
                assert(
                    metadata && typeof metadata === 'object',
                    'Recorded income action requires metadata'
                )
                if (action.type === 'StartOperatingRound') {
                    Reflect.set(metadata, 'snapshot', operatingRoundSnapshot(incomeState, rules))
                } else {
                    const companyId: unknown = Reflect.get(action, 'companyId')
                    assert(typeof companyId === 'string', 'Distribution requires a company')
                    Reflect.set(metadata, 'companyName', getCompany(incomeState, companyId).name)
                    if (incomeState.operatingSet)
                        Reflect.set(metadata, 'round', {
                            number: incomeState.operatingSet.number,
                            roundNumber: incomeState.operatingSet.roundNumber
                        })
                }
            }
        }
        cursor = history.backward(cursor, action, state.explorationState)
    }
    return true
}
