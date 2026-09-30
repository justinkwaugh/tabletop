import type { Visibility } from '@tabletop/common'
import {
    HydratedOathGameState,
    OathGameStateValidator,
    type OathProjectedState
} from '../model/gameState.js'
import { OathRuntime } from '../definition/runtime.js'

export const spectator: Visibility.Perspective = { kind: 'spectator' }

/** What `perspective` is served of `state`, through the runtime's own projector. */
export function served(
    state: OathProjectedState | HydratedOathGameState,
    perspective: Visibility.Perspective = spectator
): OathProjectedState {
    const data = state instanceof HydratedOathGameState ? state.dehydrate() : state
    if (!OathGameStateValidator.Check(data))
        throw Error('Serving requires complete canonical state')
    return OathRuntime.visibility.state.project(data, perspective)
}

export function servedJson(
    state: OathProjectedState | HydratedOathGameState,
    perspective: Visibility.Perspective = spectator
): string {
    return JSON.stringify(served(state, perspective))
}
