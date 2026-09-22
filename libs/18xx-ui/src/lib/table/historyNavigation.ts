import { ActionSource, type GameAction } from '@tabletop/common'
import {
    isBuyShares,
    isFloatCompany,
    isFinishTrack,
    isFinishStations,
    isFinishOperatingTurn,
    isFinishStockTurn,
    type BuyShares,
    type FloatCompany
} from '@tabletop/18xx'

export function isHistoryBookkeeping(action: GameAction): boolean {
    return (
        isFinishTrack(action) ||
        isFinishStations(action) ||
        isFinishOperatingTurn(action) ||
        (isFinishStockTurn(action) && action.metadata?.passed === false)
    )
}

export function shouldContinueHistoryStep(action: GameAction, next?: GameAction): boolean {
    if (next && isBuyShares(action) && isFloatCompany(next)) return true
    if (next && isFloatCompany(action))
        return next.source === ActionSource.System && !isFinishStockTurn(next)
    return isHistoryBookkeeping(action) || action.source === ActionSource.System
}

export function purchaseWithFlotation(
    actions: readonly GameAction[]
): { purchase: BuyShares; flotation: FloatCompany } | undefined {
    let flotation: FloatCompany | undefined
    for (let index = actions.length - 1; index >= 0; index--) {
        const action = actions[index]
        if (isFloatCompany(action)) flotation = action
        if (action.source === ActionSource.System || isHistoryBookkeeping(action)) continue
        return flotation &&
            isBuyShares(action) &&
            action.metadata?.companyId === flotation.companyId
            ? { purchase: action, flotation }
            : undefined
    }
    return undefined
}
