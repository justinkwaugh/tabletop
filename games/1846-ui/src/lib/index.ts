import thumbnailUrl from './images/cover.webp'
import {
    EighteenFortySixInfo,
    type EighteenFortySixProjectedState,
    type HydratedEighteenFortySixState
} from '@tabletop/1846'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
export const UiDefinition: GameUiDefinition<
    EighteenFortySixProjectedState,
    HydratedEighteenFortySixState
> = {
    info: { ...EighteenFortySixInfo, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
