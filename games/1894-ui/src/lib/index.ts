import thumbnailUrl from './images/cover.webp'
import { EighteenNinetyFourInfo } from '@tabletop/1894'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { EighteenNinetyFourState, HydratedEighteenNinetyFourState } from '@tabletop/1894'

export const UiDefinition: GameUiDefinition<
    EighteenNinetyFourState,
    HydratedEighteenNinetyFourState
> = {
    info: { ...EighteenNinetyFourInfo, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
