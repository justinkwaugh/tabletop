import thumbnailUrl from './images/cover.svg'
import {
    EighteenFortySixInfo,
    type EighteenFortySixProjectedState,
    type HydratedEighteenFortySixState
} from '@tabletop/1846'
import type { GameUiDefinition } from '@tabletop/frontend-components'
export const UiDefinition: GameUiDefinition<
    EighteenFortySixProjectedState,
    HydratedEighteenFortySixState
> = {
    info: { ...EighteenFortySixInfo, thumbnailUrl },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
