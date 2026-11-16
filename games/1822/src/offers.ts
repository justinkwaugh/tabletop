import type { HydratedAction } from '@tabletop/common'
import type { HydratedState1822, StateHandler1822 } from './state.js'

/** The turn's mark that a player declined to part with something, so it is not asked for again. */
export function declinedMark(id: string): string {
    return `declined:${id}`
}

/** The answer one player owes to an offer another made them. */
export type OfferAnswer<Answer extends HydratedAction> = {
    type: string
    is(action: HydratedAction): action is Answer
    isValid(action: Answer, state: HydratedState1822): boolean
    /** The player the pending offer waits on, if one is pending. */
    offeredTo(state: HydratedState1822): string | undefined
}

/** While an offer awaits a player, only that player's answer is taken (§3.1.2, §5.18.1). */
export function awaitsAnswer<Answer extends HydratedAction>(
    handler: StateHandler1822,
    answer: OfferAnswer<Answer>
): StateHandler1822 {
    return {
        isValidAction: (action, context) =>
            answer.is(action)
                ? answer.isValid(action, context.gameState)
                : !answer.offeredTo(context.gameState) && handler.isValidAction(action, context),
        validActionsForPlayer(playerId, context) {
            const asked = answer.offeredTo(context.gameState)
            if (!asked) return handler.validActionsForPlayer(playerId, context)
            return asked === playerId ? [answer.type] : []
        },
        enter(context) {
            const asked = answer.offeredTo(context.gameState)
            if (asked) context.gameState.activePlayerIds = [asked]
            else handler.enter(context)
        },
        onAction: (action, context) =>
            answer.is(action) ? context.gameState.machineState : handler.onAction(action, context)
    }
}
