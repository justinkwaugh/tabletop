import type { HydratedAction, MachineContext, MachineStateHandler } from '@tabletop/common'
import type { HydratedEighteenFortySixState } from './state.js'
import { AssignRevenueMarkerAction, revenueMarkerChoices } from './revenueMarkers.js'
import { BuildPrivateTrackAction, constructionPrivateIds } from './privateConstruction.js'
import { PlaceCWIStationAction, chicagoPrivateStation } from './privateStation.js'

export class PrivatePowersHandler implements MachineStateHandler<
    HydratedAction,
    HydratedEighteenFortySixState
> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, HydratedEighteenFortySixState>
    ) {}
    enter(context: MachineContext<HydratedEighteenFortySixState>): void {
        if (!context.gameState.pendingRevenueMarker) this.handler.enter(context)
    }
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenFortySixState>
    ): boolean {
        if (
            action instanceof AssignRevenueMarkerAction ||
            action instanceof BuildPrivateTrackAction ||
            action instanceof PlaceCWIStationAction
        )
            return action.isValid(context.gameState)
        return (
            !context.gameState.pendingRevenueMarker && this.handler.isValidAction(action, context)
        )
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenFortySixState>
    ): string[] {
        const state = context.gameState
        if (state.pendingRevenueMarker)
            return state.activePlayerIds.includes(playerId) ? ['AssignRevenueMarker'] : []
        return [
            ...this.handler.validActionsForPlayer(playerId, context),
            ...(revenueMarkerChoices(state, playerId).length ? ['AssignRevenueMarker'] : []),
            ...(constructionPrivateIds(state, playerId).length ? ['BuildPrivateTrack'] : []),
            ...(chicagoPrivateStation(state, playerId) ? ['PlaceCWIStation'] : [])
        ]
    }
    onAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenFortySixState>
    ): string {
        return action instanceof AssignRevenueMarkerAction ||
            action instanceof BuildPrivateTrackAction ||
            action instanceof PlaceCWIStationAction
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
