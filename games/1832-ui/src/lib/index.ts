import { EighteenThirtyTwoInfo } from '@tabletop/1832'
import type { EighteenThirtyTwoState, HydratedEighteenThirtyTwoState } from '@tabletop/1832'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import thumbnailUrl from './images/cover.webp'

export const UiDefinition: GameUiDefinition<
    EighteenThirtyTwoState,
    HydratedEighteenThirtyTwoState
> = {
    info: { ...EighteenThirtyTwoInfo, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
