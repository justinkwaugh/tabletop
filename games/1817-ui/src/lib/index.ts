import thumbnailUrl from './images/cover.jpg'
import { EighteenSeventeenInfo } from '@tabletop/1817'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import type { EighteenSeventeenState, HydratedEighteenSeventeenState } from '@tabletop/1817'

export const UiDefinition: GameUiDefinition<
    EighteenSeventeenState,
    HydratedEighteenSeventeenState
> = {
    info: { ...EighteenSeventeenInfo, thumbnailUrl },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
