import { EighteenThirtyInfo } from '@tabletop/1830'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'

export const UiDefinition: GameUiDefinition<EighteenXXState, HydratedEighteenXXState> = {
    info: { ...EighteenThirtyInfo, thumbnailUrl: '' },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}

export { EighteenThirtyMapView } from './mapView.js'
