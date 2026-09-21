import { Shikoku1889TitleRules } from '@tabletop/shikoku-1889'

import { Shikoku1889MapView } from './mapView.js'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import { Definition } from '@tabletop/shikoku-1889'
import {
    DefaultColorizer,
    mountDynamicComponent,
    type GameUIRuntime
} from '@tabletop/frontend-components'
import type { GameState, HydratedGameState } from '@tabletop/common'
import Table from './Table.svelte'

export const UiRuntime: GameUIRuntime<GameState, HydratedGameState> = {
    ...Definition.runtime,
    gameUI: { component: Table, load: async () => Table, mount: mountDynamicComponent },
    sessionClass: createEighteenXXSessionClass(Shikoku1889TitleRules, Shikoku1889MapView),
    colorizer: new DefaultColorizer()
}
