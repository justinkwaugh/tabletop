import { isBuyTrain, isDistributeEarnings } from '@tabletop/18xx'
import { ActionSource, type GameAction } from '@tabletop/common'
import { DefaultTableTerms, type ResolvedTableTerms } from '../presentation/tableTerms.js'
import { joinDetails, type HistoryDescription } from './historyDescription.js'

export function describeAutomaticStep(
    action: GameAction,
    description: HistoryDescription,
    terms: ResolvedTableTerms = DefaultTableTerms
): HistoryDescription {
    return (isBuyTrain(action) || isDistributeEarnings(action)) &&
        action.source === ActionSource.System &&
        !action.playerId
        ? {
              ...description,
              detail: joinDetails(description.detail, `Automatic: no ${terms.presidentWord}`)
          }
        : description
}
