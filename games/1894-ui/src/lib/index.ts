import thumbnailUrl from './images/cover.webp'
import { EighteenNinetyFourInfo } from '@tabletop/1894'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import type { EighteenNinetyFourState, HydratedEighteenNinetyFourState } from '@tabletop/1894'

export const UiDefinition: GameUiDefinition<
    EighteenNinetyFourState,
    HydratedEighteenNinetyFourState
> = {
    info: { ...EighteenNinetyFourInfo, thumbnailUrl },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}
