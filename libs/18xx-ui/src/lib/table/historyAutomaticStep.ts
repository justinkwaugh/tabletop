import { isBuyTrain, isDistributeEarnings } from '@tabletop/18xx'
import { ActionSource, type GameAction } from '@tabletop/common'
import { joinDetails, type HistoryDescription } from './historyDescription.js'

export function describeAutomaticStep(
    action: GameAction,
    description: HistoryDescription
): HistoryDescription {
    return (isBuyTrain(action) || isDistributeEarnings(action)) &&
        action.source === ActionSource.System &&
        !action.playerId
        ? { ...description, detail: joinDetails(description.detail, 'Automatic: no president') }
        : description
}
