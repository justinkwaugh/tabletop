import {
    ActionSource,
    isCallGameAction,
    isCascadedSystemAction,
    type GameAction
} from '@tabletop/common'
import {
    isBuyShares,
    isEndGame,
    isFloatCompany,
    isFinishTrack,
    isFinishStations,
    isFinishOperatingTurn,
    isFinishStockTurn,
    isSetPrivatePowerRequest,
    isDropPrivatePowerRequest,
    isStockInstructionAction
} from '@tabletop/18xx'

export function isHistoryBookkeeping(action: GameAction): boolean {
    return (
        isFinishTrack(action) ||
        isFinishStations(action) ||
        isFinishOperatingTurn(action) ||
        (isFinishStockTurn(action) && action.metadata?.passed === false) ||
        isStockInstructionAction(action) ||
        isSetPrivatePowerRequest(action) ||
        isDropPrivatePowerRequest(action)
    )
}

export function isGameEndAction(action: GameAction): boolean {
    return isEndGame(action) || isCallGameAction(action)
}

export function isAutomaticStockDecision(action: GameAction): boolean {
    return (
        action.source === ActionSource.System &&
        (isBuyShares(action) || (isFinishStockTurn(action) && action.metadata?.passed === true))
    )
}

function isGeneratedConsequence(action: GameAction): boolean {
    return isCascadedSystemAction(action) && !isAutomaticStockDecision(action)
}

export function shouldContinueHistoryStep(action: GameAction, next?: GameAction): boolean {
    if (next && isBuyShares(action) && isFloatCompany(next)) return true
    if (next && isFloatCompany(action))
        return next.source === ActionSource.System && !isFinishStockTurn(next)
    return isHistoryBookkeeping(action) || isGeneratedConsequence(action)
}
