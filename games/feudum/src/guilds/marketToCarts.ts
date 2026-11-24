import { HydratedFeudumGameState } from '../model/gameState.js'
import {
    bestCartCompletions,
    movableToCarts,
    moveMarketToCarts,
    reasonCartPicksRefused,
    reasonMoveShort
} from '../model/market.js'
import type { GuildFunctionParams, GuildFunctionRow } from './guildFunction.js'

function performMove(
    state: HydratedFeudumGameState,
    kind: 'merchant-push' | 'alchemist-pull',
    { goods = [] }: GuildFunctionParams
) {
    const { moves, completed } = moveMarketToCarts(state, goods)
    return { kind, moves, completed }
}

/** R-4.6.4, R-4.6.5 The Merchant push and the Alchemist pull. */
export function marketToCartsRow(
    kind: 'merchant-push' | 'alchemist-pull',
    cap: number,
    reached: (completed: number) => number
): GuildFunctionRow {
    return {
        /** R-4.6.1 At least one must move. */
        reasonClosed(state) {
            return movableToCarts(state, cap) > 0
                ? undefined
                : 'No market good fits in the carts and piles.'
        },

        /** R-4.6.1, R-4.6-H5 As many as fit, up to the stated number. */
        reasonRefused(state, _actor, { goods = [] }) {
            return (
                reasonCartPicksRefused(state, goods, cap) ??
                reasonMoveShort(goods, movableToCarts(state, cap))
            )
        },

        perform(state, _actor, params) {
            const details = performMove(state, kind, params)
            return { details, completions: reached(details.completed.length) }
        },

        preview(state, _actor, params) {
            if (reasonCartPicksRefused(state, params.goods ?? [], cap)) {
                return undefined
            }
            const details = performMove(
                new HydratedFeudumGameState(state.dehydrate()),
                kind,
                params
            )
            return { details, completions: reached(details.completed.length) }
        },

        /** R-4.6.1 */
        bestCompletions(state) {
            return reached(bestCartCompletions(state, cap))
        }
    }
}
