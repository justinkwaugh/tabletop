import type { HydratedAction, MachineContext } from '@tabletop/common'
import type { EighteenThirtyTwoStateHandler, HydratedEighteenThirtyTwoState } from './state.js'

/** A title action offered within a family state, which stays in that state when taken. */
export type TitleStepAction = {
    type: string
    available(state: HydratedEighteenThirtyTwoState, playerId: string): boolean
    isValid(action: HydratedAction, state: HydratedEighteenThirtyTwoState): boolean
}

export class TitleActionsHandler implements EighteenThirtyTwoStateHandler {
    constructor(
        private readonly handler: EighteenThirtyTwoStateHandler,
        private readonly actions: readonly TitleStepAction[]
    ) {}
    private own(action: HydratedAction): TitleStepAction | undefined {
        return this.actions.find((entry) => entry.type === action.type)
    }
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenThirtyTwoState>
    ): boolean {
        const own = this.own(action)
        return own
            ? own.isValid(action, context.gameState)
            : this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenThirtyTwoState>
    ): string[] {
        return [
            ...this.handler.validActionsForPlayer(playerId, context),
            ...this.actions
                .filter((entry) => entry.available(context.gameState, playerId))
                .map((entry) => entry.type)
        ]
    }
    enter(context: MachineContext<HydratedEighteenThirtyTwoState>): void {
        this.handler.enter(context)
    }
    onAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenThirtyTwoState>
    ): string {
        return this.own(action)
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
