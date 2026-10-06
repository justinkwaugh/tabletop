import { Shikoku1889TitleRules } from '@tabletop/shikoku-1889'
import './styles.css'

import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import type { HydratedShikoku1889State, Shikoku1889State } from '@tabletop/shikoku-1889'
import { Definition } from '@tabletop/shikoku-1889'
import { Shikoku1889MapView } from './mapView.js'
import { Shikoku1889Presentation } from './presentation.js'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<Shikoku1889State, HydratedShikoku1889State> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: createEighteenXXSessionClass(
        Shikoku1889TitleRules,
        Shikoku1889MapView,
        Shikoku1889Presentation
    ),
    colorizer: new DefaultColorizer()
}
