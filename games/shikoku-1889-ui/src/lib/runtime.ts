import { Shikoku1889TitleRules } from '@tabletop/shikoku-1889'

import { Shikoku1889MapView } from './mapView.js'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import { Definition } from '@tabletop/shikoku-1889'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
import { Shikoku1889Presentation } from './presentation.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<EighteenXXState, HydratedEighteenXXState> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: createEighteenXXSessionClass(
        Shikoku1889TitleRules,
        Shikoku1889MapView,
        Shikoku1889Presentation
    ),
    colorizer: new DefaultColorizer()
}
