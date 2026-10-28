import './styles.css'
import { Definition, EighteenThirtyTitleRules } from '@tabletop/1830'
import { EighteenThirtyMapView } from './mapView.js'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import type { EighteenThirtyState, HydratedEighteenThirtyState } from '@tabletop/1830'
import { EighteenThirtyPresentation } from './presentation.js'
import Table from './Table.svelte'
import { createRouteWorker } from './routeWorker.js'

export const UiRuntime: GameUIRuntime<EighteenThirtyState, HydratedEighteenThirtyState> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: createEighteenXXSessionClass(
        EighteenThirtyTitleRules,
        EighteenThirtyMapView,
        EighteenThirtyPresentation,
        createRouteWorker
    ),
    colorizer: new DefaultColorizer()
}
