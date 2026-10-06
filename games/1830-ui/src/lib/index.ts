import { EighteenThirtyInfo } from '@tabletop/1830'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import type { EighteenThirtyState, HydratedEighteenThirtyState } from '@tabletop/1830'

export const UiDefinition: GameUiDefinition<EighteenThirtyState, HydratedEighteenThirtyState> = {
    info: { ...EighteenThirtyInfo, thumbnailUrl: '' },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}

export { EighteenThirtyMapView } from './mapView.js'
