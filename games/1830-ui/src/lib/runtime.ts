import './styles.css'
import { Definition, EighteenThirtyTitleRules } from '@tabletop/1830'
import { EighteenThirtyMapView } from './mapView.js'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
import { EighteenThirtyPresentation } from './presentation.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<EighteenXXState, HydratedEighteenXXState> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: createEighteenXXSessionClass(
        EighteenThirtyTitleRules,
        EighteenThirtyMapView,
        EighteenThirtyPresentation
    ),
    colorizer: new DefaultColorizer()
}
