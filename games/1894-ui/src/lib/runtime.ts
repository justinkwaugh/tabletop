import './styles.css'
import { Definition, EighteenNinetyFourTitleRules } from '@tabletop/1894'
import { EighteenNinetyFourMapView } from './mapView.js'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import type { EighteenNinetyFourState, HydratedEighteenNinetyFourState } from '@tabletop/1894'
import { EighteenNinetyFourPresentation } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<EighteenNinetyFourState, HydratedEighteenNinetyFourState> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: createEighteenXXSessionClass(
        EighteenNinetyFourTitleRules,
        EighteenNinetyFourMapView,
        EighteenNinetyFourPresentation,
        createRouteWorker
    ),
    colorizer: new DefaultColorizer()
}
