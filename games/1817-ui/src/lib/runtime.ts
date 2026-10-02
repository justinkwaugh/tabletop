import './styles.css'
import { Definition, EighteenSeventeenTitleRules } from '@tabletop/1817'
import { EighteenSeventeenMapView } from './mapView.js'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
import { EighteenSeventeenPresentation } from './presentation.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<EighteenXXState, HydratedEighteenXXState> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: createEighteenXXSessionClass(
        EighteenSeventeenTitleRules,
        EighteenSeventeenMapView,
        EighteenSeventeenPresentation
    ),
    colorizer: new DefaultColorizer()
}
