import {
    HydratedStartOperatingTurn,
    isRunTrains,
    type EighteenXXStateHandler
} from '@tabletop/18xx'
import {
    AssignLuxuryFerryAction,
    BuyFerryAction,
    afterRoutesRun,
    ferryChoices,
    luxuryChoices
} from '../ferries.js'
import type { HydratedState1833NE } from '../state.js'

type Handler = EighteenXXStateHandler<HydratedState1833NE>

/** Adds the title's ferry Actions to an operating step that stays where it is after them. */
function withFerries(family: Handler, buying: boolean): Handler {
    const ferryActions = (playerId: string, state: HydratedState1833NE) =>
        state.isActivePlayer(playerId)
            ? [
                  ...(buying && ferryChoices(state).length ? ['BuyFerry'] : []),
                  ...(luxuryChoices(state).length ? ['AssignLuxuryFerry'] : [])
              ]
            : []
    return {
        enter: (context) => family.enter(context),
        validActionsForPlayer: (playerId, context) => [
            ...family.validActionsForPlayer(playerId, context),
            ...ferryActions(playerId, context.gameState)
        ],
        isValidAction(action, context) {
            if (action instanceof AssignLuxuryFerryAction) return action.isValid(context.gameState)
            if (buying && action instanceof BuyFerryAction) return action.isValid(context.gameState)
            return family.isValidAction(action, context)
        },
        onAction(action, context) {
            if (action instanceof AssignLuxuryFerryAction || action instanceof BuyFerryAction)
                return context.gameState.machineState
            if (isRunTrains(action)) afterRoutesRun(context.gameState, action.companyId)
            return family.onAction(action, context)
        }
    }
}

export const layingTrack1833NE = (family: Handler): Handler => withFerries(family, true)
export const runningTrains1833NE = (family: Handler): Handler => withFerries(family, false)

/** A corporation buys one ferry per operating turn. */
export function operatingSet1833NE(family: Handler): Handler {
    return {
        enter: (context) => family.enter(context),
        validActionsForPlayer: (playerId, context) =>
            family.validActionsForPlayer(playerId, context),
        isValidAction: (action, context) => family.isValidAction(action, context),
        onAction(action, context) {
            if (action instanceof HydratedStartOperatingTurn) delete context.gameState.ferryBuyerId
            return family.onAction(action, context)
        }
    }
}
