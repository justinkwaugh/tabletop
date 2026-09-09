import { Shikoku1889MapView } from './mapView.js'
import { createFinanceExampleSessionClass } from '@tabletop/18xx-ui'
import { Definition, Shikoku1889StockRules, Shikoku1889CompanyRules } from '@tabletop/shikoku-1889'
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
    sessionClass: createFinanceExampleSessionClass(
        Shikoku1889StockRules,
        Shikoku1889CompanyRules,
        Shikoku1889MapView
    ),
    colorizer: new DefaultColorizer()
}
