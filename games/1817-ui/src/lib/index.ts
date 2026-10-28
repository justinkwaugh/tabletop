import thumbnailUrl from './images/cover.webp'
import { EighteenSeventeenInfo } from '@tabletop/1817'
import {
    gameClientCapabilities,
    type GameUiDefinition
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { EighteenSeventeenState, HydratedEighteenSeventeenState } from '@tabletop/1817'

export const UiDefinition: GameUiDefinition<
    EighteenSeventeenState,
    HydratedEighteenSeventeenState
> = {
    info: { ...EighteenSeventeenInfo, thumbnailUrl, clientCapabilities: gameClientCapabilities() },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
