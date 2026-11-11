import type { HydratedAction, MachineContext, MachineStateHandler } from '@tabletop/common'
import { discardWritOffers, isDiscardWrit } from '../actions/discardWrit.js'
import { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

type FeudumStateHandler = MachineStateHandler<HydratedAction, HydratedFeudumGameState>

/**
 * R-4.4.4, R-4.4-H5 A writ may be discarded at any time, so every state takes `DiscardWrit` from
 * any seat holding one. The state that asks for the discard (the writ limit) decides what follows
 * it; in every other state play stays where it was.
 */
export function withDiscardAnyTime(handler: FeudumStateHandler): FeudumStateHandler {
    return {
        isValidAction: (action, context) =>
            isDiscardWrit(action)
                ? discardWritOffers(context.gameState, action.playerId).includes(action.writId)
                : handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) => {
            const types = handler.validActionsForPlayer(playerId, context)
            return discardWritOffers(context.gameState, playerId).length > 0 &&
                !types.includes(ActionType.DiscardWrit)
                ? [...types, ActionType.DiscardWrit]
                : types
        },
        enter: (context) => handler.enter(context),
        onAction: (action, context: MachineContext<HydratedFeudumGameState>) =>
            isDiscardWrit(action) && !handler.isValidAction(action, context)
                ? (context.gameState.machineState as MachineState)
                : handler.onAction(action, context)
    }
}
