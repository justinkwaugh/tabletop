import type {
    HydratedAction,
    HydratedGameState,
    MachineContext,
    MachineStateHandler
} from '@tabletop/common'
import type { FinancialState } from '../finance/finance.js'
import {
    purchasableAccessRights,
    type AccessRightPurchaseState,
    type AccessRightRules
} from './accessRights.js'
import { HydratedBuyAccessRight } from './buyAccessRight.js'

type State = HydratedGameState & AccessRightPurchaseState & FinancialState

/** Lets the operating company's president buy rights at any point of its turn. */
export class AccessRightsHandler<S extends State> implements MachineStateHandler<
    HydratedAction,
    S
> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, S>,
        private readonly rules: AccessRightRules
    ) {}
    isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
        return action instanceof HydratedBuyAccessRight
            ? context.gameState.activePlayerIds.includes(action.playerId) &&
                  action.isValid(context.gameState)
            : this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<S>): string[] {
        const actions = this.handler.validActionsForPlayer(playerId, context)
        const state = context.gameState
        return actions.length &&
            state.activePlayerIds.includes(playerId) &&
            purchasableAccessRights(state, this.rules, playerId).length
            ? [...actions, 'BuyAccessRight']
            : actions
    }
    enter(context: MachineContext<S>): void {
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<S>): string {
        return action instanceof HydratedBuyAccessRight
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
