import type { HydratedAction, HydratedGameState, MachineStateHandler } from '@tabletop/common'

/**
 * Starts an operating step's record on entry, ahead of everything ``handler`` wraps, so a System
 * Action due first is recorded in a state that loads.
 */
export function startsStep<State extends HydratedGameState>(
    handler: MachineStateHandler<HydratedAction, State>,
    start: (state: State) => void
): MachineStateHandler<HydratedAction, State> {
    return {
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        enter(context) {
            start(context.gameState)
            handler.enter(context)
        },
        onAction: (action, context) => handler.onAction(action, context)
    }
}
