import type { HydratedAction, HydratedGameState, MachineStateHandler } from '@tabletop/common'

export function clearsOnLeaving<State extends HydratedGameState>(
    handler: MachineStateHandler<HydratedAction, State>,
    machineState: string,
    clear: (state: State) => void
): MachineStateHandler<HydratedAction, State> {
    return {
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        enter: (context) => handler.enter(context),
        onAction(action, context) {
            const next = handler.onAction(action, context)
            if (next !== machineState) clear(context.gameState)
            return next
        }
    }
}
