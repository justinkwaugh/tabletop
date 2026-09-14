import { ActionSource, type GameAction } from '@tabletop/common'
import { isRespondToTrackConsent, type FinanceExampleState } from '@tabletop/18xx'

export function trackConsentDecline(actions: readonly GameAction[], state: FinanceExampleState) {
    if (state.machineState !== 'LayingTrack' || state.trackConsent || !state.trackStep) return
    const action = actions
        .slice(0, state.actionCount)
        .findLast((action) => action.source === ActionSource.User)
    if (
        action &&
        isRespondToTrackConsent(action) &&
        action.metadata &&
        !action.metadata.accepted &&
        action.metadata.request.details.companyId === state.trackStep.companyId
    )
        return action
}
