import { ActionSource, type HydratedAction, type MachineContext } from '@tabletop/common'
import { controllingOwner } from '../finance/finance.js'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import type { StockState } from './stockState.js'

/**
 * Whether a player may act on their stock turn for a company they preside, in place of acting
 * for themselves: before any action of their own, or after earlier actions for that company.
 */
export function corporateTurnOpen(
    state: StockState & { machineState: string; companyAuction?: object },
    playerId: string,
    companyId: string
): boolean {
    const turn = state.stockRound.turn
    return (
        state.machineState === 'StockRound' &&
        !state.stockRound.completed &&
        !state.companyAuction &&
        state.activePlayerIds.includes(playerId) &&
        controllingOwner(state, companyId)?.playerId === playerId &&
        (turn.corporateAction ? turn.corporateAction.companyId === companyId : !turn.acted)
    )
}

/** An action a president takes for their company on their stock turn. */
export type CorporateStockAction<State> = {
    type: string
    available(state: State, playerId: string): boolean
    isValid(action: HydratedAction, state: State): boolean
    /** Where play goes after the action, when not back to the stock turn. */
    nextState?(state: State): string | undefined
}

/**
 * Offers a president's actions for their company alongside their own; once they act for a
 * company, only its further actions and finishing the turn remain.
 */
export class CorporateStockActionsHandler<
    State extends HydratedEighteenXXState
> implements EighteenXXStateHandler<State> {
    constructor(
        private readonly handler: EighteenXXStateHandler<State>,
        private readonly actions: readonly CorporateStockAction<State>[]
    ) {}
    private own(action: HydratedAction): CorporateStockAction<State> | undefined {
        return this.actions.find((entry) => entry.type === action.type)
    }
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        const own = this.own(action)
        if (own) return action.source === ActionSource.User && own.isValid(action, state)
        if (
            state.stockRound.turn.corporateAction &&
            action.source === ActionSource.User &&
            action.type !== 'FinishStockTurn'
        )
            return false
        return this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        const actions = this.handler.validActionsForPlayer(playerId, context)
        if (!actions.includes('FinishStockTurn')) return actions
        const corporate = this.actions
            .filter((entry) => entry.available(state, playerId))
            .map((entry) => entry.type)
        return state.stockRound.turn.corporateAction
            ? [...corporate, 'FinishStockTurn']
            : [...actions, ...corporate]
    }
    enter(context: MachineContext<State>): void {
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        const own = this.own(action)
        if (!own) return this.handler.onAction(action, context)
        return own.nextState?.(context.gameState) ?? context.gameState.machineState
    }
}
