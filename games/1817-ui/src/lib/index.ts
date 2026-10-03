import { EighteenSeventeenInfo } from '@tabletop/1817'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'

export const UiDefinition: GameUiDefinition<EighteenXXState, HydratedEighteenXXState> = {
    info: { ...EighteenSeventeenInfo, thumbnailUrl: '' },
    runtime: async () => (await import('./runtime.js')).UiRuntime
}

export { EighteenSeventeenMapView } from './mapView.js'
