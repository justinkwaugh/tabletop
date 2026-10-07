import './styles.css'
import { Definition, EighteenThirtyTwoTitleRules } from '@tabletop/1832'
import type { EighteenThirtyTwoState, HydratedEighteenThirtyTwoState } from '@tabletop/1832'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { EighteenThirtyTwoMapView } from './mapView.js'
import { EighteenThirtyTwoPresentation } from './presentation.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<EighteenThirtyTwoState, HydratedEighteenThirtyTwoState> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: createEighteenXXSessionClass(
        EighteenThirtyTwoTitleRules,
        EighteenThirtyTwoMapView,
        EighteenThirtyTwoPresentation
    ),
    colorizer: new DefaultColorizer()
}
