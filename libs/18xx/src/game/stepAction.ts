import type { HydratedAction } from '@tabletop/common'

/** An action a title offers within a family state, with when it is offered and valid. */
export type StepAction<State> = {
    type: string
    available(state: State, playerId: string): boolean
    isValid(action: HydratedAction, state: State): boolean
}

/** A step action whose hydrated class judges its own validity. */
export function stepAction<State, Action extends HydratedAction>(
    type: string,
    hydrated: (action: HydratedAction) => action is Action & { isValid(state: State): boolean },
    available: StepAction<State>['available']
): StepAction<State> {
    return {
        type,
        available,
        isValid: (action, state) => hydrated(action) && action.isValid(state)
    }
}
