import { ActionSource, type GameAction } from '@tabletop/common'
import {
    isBuyShares,
    isFloatCompany,
    isFinishTrack,
    isFinishStations,
    isFinishOperatingTurn,
    isFinishStockTurn,
    isSetStockInstruction,
    isStopStockInstruction,
    isSetPrivatePowerRequest,
    isDropPrivatePowerRequest
} from '@tabletop/18xx'

export function isHistoryBookkeeping(action: GameAction): boolean {
    return (
        isFinishTrack(action) ||
        isFinishStations(action) ||
        isFinishOperatingTurn(action) ||
        (isFinishStockTurn(action) && action.metadata?.passed === false) ||
        isSetStockInstruction(action) ||
        isStopStockInstruction(action) ||
        isSetPrivatePowerRequest(action) ||
        isDropPrivatePowerRequest(action)
    )
}

export function isAutomaticStockDecision(action: GameAction): boolean {
    return (
        action.source === ActionSource.System &&
        (isBuyShares(action) || (isFinishStockTurn(action) && action.metadata?.passed === true))
    )
}

function isGeneratedConsequence(action: GameAction): boolean {
    return action.source === ActionSource.System && !isAutomaticStockDecision(action)
}

export function shouldContinueHistoryStep(action: GameAction, next?: GameAction): boolean {
    if (next && isBuyShares(action) && isFloatCompany(next)) return true
    if (next && isFloatCompany(action))
        return next.source === ActionSource.System && !isFinishStockTurn(next)
    return isHistoryBookkeeping(action) || isGeneratedConsequence(action)
}
