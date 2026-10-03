import {
    ActionSource,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { nextOperatingCompany, type OperatingState } from '../operating/operatingSet.js'
import { canTakeLoan, isTakeLoan } from './takeLoan.js'
import type { LoanRules, LoanState } from './loans.js'

type State = HydratedGameState & OperatingState & LoanState

/** Lets the operating company's president borrow at any point of its turn before interest. */
export class LoanTakingHandler<S extends State> implements MachineStateHandler<HydratedAction, S> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, S>,
        private readonly rules: LoanRules
    ) {}

    private canBorrow(state: S, playerId: string): boolean {
        const companyId = nextOperatingCompany(state)
        return (
            !!companyId &&
            !state.loanStep &&
            state.activePlayerIds.includes(playerId) &&
            canTakeLoan(state, this.rules, playerId, companyId)
        )
    }

    isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
        if (!isTakeLoan(action)) return this.handler.isValidAction(action, context)
        return (
            action.source === ActionSource.User &&
            action.companyId === nextOperatingCompany(context.gameState) &&
            this.canBorrow(context.gameState, action.playerId)
        )
    }

    validActionsForPlayer(playerId: string, context: MachineContext<S>): string[] {
        const actions = this.handler.validActionsForPlayer(playerId, context)
        return actions.length && this.canBorrow(context.gameState, playerId)
            ? [...actions, 'TakeLoan']
            : actions
    }

    enter(context: MachineContext<S>): void {
        this.handler.enter(context)
    }

    onAction(action: HydratedAction, context: MachineContext<S>): string {
        return isTakeLoan(action)
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
