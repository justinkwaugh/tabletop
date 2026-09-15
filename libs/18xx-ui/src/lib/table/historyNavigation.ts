import type { GameAction } from '@tabletop/common'
import { isFinishTrack, isFinishStations, isFinishOperatingTurn, isFinishStockTurn } from '@tabletop/18xx'

export function isHistoryBookkeeping(action: GameAction): boolean {
    return isFinishTrack(action) || isFinishStations(action) || isFinishOperatingTurn(action) ||
        (isFinishStockTurn(action) && action.metadata?.passed === false)
}
