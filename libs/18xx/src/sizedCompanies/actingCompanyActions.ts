import { ActionSource, type HydratedAction, type MachineContext } from '@tabletop/common'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'

/**
 * A title's own action that a company may take wherever the family lets it act between rounds,
 * as 18USA's Pullman scrapping (§12.7): offered beside the step's actions, it leaves the step
 * where it is.
 */
export type ActingCompanyAction<State> = {
    type: string
    available(state: State, playerId: string, companyId: string): boolean
    isValid(action: HydratedAction, state: State, companyId: string): boolean
}

/** The title's company actions available to the company's president now. */
export function actingCompanyChoices<State>(
    actions: readonly ActingCompanyAction<State>[],
    state: State,
    playerId: string,
    companyId: string
): string[] {
    return actions
        .filter((action) => action.available(state, playerId, companyId))
        .map((action) => action.type)
}

/** The title's company action this is, when it is one valid for the company now. */
export function actingCompanyAction<State>(
    actions: readonly ActingCompanyAction<State>[],
    action: HydratedAction,
    state: State,
    companyId: string
): ActingCompanyAction<State> | undefined {
    return actions.find(
        (entry) => entry.type === action.type && entry.isValid(action, state, companyId)
    )
}

/**
 * Wraps a state's handler to offer the title's company actions to the acting company's president
 * while the state's own actions are open, leaving the state where it is after one.
 */
export class ActingCompanyActionsHandler<
    State extends HydratedEighteenXXState
> implements EighteenXXStateHandler<State> {
    constructor(
        private readonly handler: EighteenXXStateHandler<State>,
        private readonly actions: readonly ActingCompanyAction<State>[],
        private readonly actingCompanyId: (state: State) => string | undefined
    ) {}
    private own(action: HydratedAction, state: State): boolean {
        const companyId = this.actingCompanyId(state)
        return !!companyId && !!actingCompanyAction(this.actions, action, state, companyId)
    }
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (this.actions.some((entry) => entry.type === action.type))
            return action.source === ActionSource.User && this.own(action, context.gameState)
        return this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const actions = this.handler.validActionsForPlayer(playerId, context)
        const companyId = this.actingCompanyId(context.gameState)
        if (!actions.length || !companyId) return actions
        return [
            ...actions,
            ...actingCompanyChoices(this.actions, context.gameState, playerId, companyId)
        ]
    }
    enter(context: MachineContext<State>): void {
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return this.actions.some((entry) => entry.type === action.type)
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
