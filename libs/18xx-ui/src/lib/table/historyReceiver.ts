import { ActionSource, type GameAction } from '@tabletop/common'
import { joinDetails, type HistoryDescription } from './historyDescription.js'
import { companyActedFor } from './lastAction.js'

type ReceiverStates = ReadonlyMap<string, { before?: { receiverCompanyIds: readonly string[] } }>

function isAutomaticReceiverAction(action: GameAction, states: ReceiverStates): boolean {
    if (action.source !== ActionSource.System) return false
    const companyId = companyActedFor(action)
    return !!companyId && !!states.get(action.id)?.before?.receiverCompanyIds.includes(companyId)
}

/** The System records these under a player only because every operating Action needs one. */
export function withoutReceiverActor(
    action: GameAction,
    description: HistoryDescription,
    states: ReceiverStates
): HistoryDescription {
    if (!isAutomaticReceiverAction(action, states)) return description
    return {
        ...description,
        omitActor: true,
        detail: description.routine
            ? description.detail
            : joinDetails(description.detail, 'Automatic: no president')
    }
}
