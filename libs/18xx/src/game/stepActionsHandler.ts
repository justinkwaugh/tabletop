import type { HydratedAction, MachineContext } from '@tabletop/common'
import type { HydratedEighteenXXState } from './eighteenXXState.js'
import type { EighteenXXStateHandler } from './eighteenXXTitleRules.js'
import type { StepAction } from './stepAction.js'

export class StepActionsHandler<
    State extends HydratedEighteenXXState
> implements EighteenXXStateHandler<State> {
    constructor(
        private readonly handler: EighteenXXStateHandler<State>,
        private readonly actions: readonly StepAction<State>[]
    ) {}
    private own(action: HydratedAction): StepAction<State> | undefined {
        return this.actions.find((entry) => entry.type === action.type)
    }
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const own = this.own(action)
        return own
            ? own.isValid(action, context.gameState)
            : this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        return [
            ...this.handler.validActionsForPlayer(playerId, context),
            ...this.actions
                .filter((entry) => entry.available(context.gameState, playerId))
                .map((entry) => entry.type)
        ]
    }
    enter(context: MachineContext<State>): void {
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return this.own(action)
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
