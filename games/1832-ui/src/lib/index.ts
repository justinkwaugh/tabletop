import { EighteenThirtyTwoInfo } from '@tabletop/1832'
import type { EighteenThirtyTwoState, HydratedEighteenThirtyTwoState } from '@tabletop/1832'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import thumbnailUrl from './images/cover.svg'

export const UiDefinition: GameUiDefinition<
    EighteenThirtyTwoState,
    HydratedEighteenThirtyTwoState
> = {
    info: { ...EighteenThirtyTwoInfo, thumbnailUrl },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
