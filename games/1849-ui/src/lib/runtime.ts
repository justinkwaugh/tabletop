import './styles.css'
import { Definition, TitleRules1849 } from '@tabletop/1849'
import type { HydratedState1849, State1849 } from '@tabletop/1849'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import { MapView1849 } from './mapView.js'
import { Presentation1849 } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<State1849, HydratedState1849> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: createEighteenXXSessionClass(
        TitleRules1849,
        MapView1849,
        Presentation1849,
        createRouteWorker
    ),
    colorizer: new DefaultColorizer()
}
