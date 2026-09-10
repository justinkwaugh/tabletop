import type {
    HydratedAction,
    HydratedGameState,
    MachineContext,
    MachineStateHandler
} from '@tabletop/common'
import type { FundingState } from './trainFunding.js'
export class BankruptHandler<
    State extends HydratedGameState & FundingState
> implements MachineStateHandler<HydratedAction, State> {
    isValidAction(): boolean {
        return false
    }
    validActionsForPlayer(): string[] {
        return []
    }
    enter(context: MachineContext<State>): void {
        context.gameState.activePlayerIds = []
    }
    onAction(): string {
        return 'Bankrupt'
    }
}
