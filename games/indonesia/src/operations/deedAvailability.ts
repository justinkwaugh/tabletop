import { MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { RemoveCompanyDeed, isRemoveCompanyDeed } from '../actions/removeCompanyDeed.js'
import { HydratedStartCompany } from '../actions/startCompany.js'

export function queueRemovalForUnstartableAvailableDeeds(
    state: HydratedIndonesiaGameState,
    context?: MachineContext
): void {
    if (!context) {
        return
    }

    const alreadyQueuedRemovalIds = new Set<string>()
    for (const pendingAction of context.getPendingActions()) {
        if (!isRemoveCompanyDeed(pendingAction)) {
            continue
        }
        alreadyQueuedRemovalIds.add(pendingAction.deedId)
    }

    for (const deed of state.availableDeeds) {
        if (alreadyQueuedRemovalIds.has(deed.id)) {
            continue
        }
        if (HydratedStartCompany.canDeedBeStarted(state, deed.id)) {
            continue
        }

        context.addSystemAction(RemoveCompanyDeed, {
            deedId: deed.id
        })
        alreadyQueuedRemovalIds.add(deed.id)
    }
}
