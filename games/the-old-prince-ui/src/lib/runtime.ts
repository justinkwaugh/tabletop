import { TheOldPrinceTrainRules } from '@tabletop/the-old-prince'
import { TheOldPrinceStationRules } from '@tabletop/the-old-prince'
import { TheOldPrinceMapView } from './mapView.js'
import { createFinanceExampleSessionClass } from '@tabletop/18xx-ui'
import {
    Definition,
    TheOldPrinceStockRules,
    TheOldPrinceCompanyRules,
    TheOldPrinceTrackRules
} from '@tabletop/the-old-prince'
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
        TheOldPrinceStockRules,
        TheOldPrinceCompanyRules,
        TheOldPrinceMapView,
        TheOldPrinceTrackRules,
        TheOldPrinceStationRules,
        TheOldPrinceTrainRules
    ),
    colorizer: new DefaultColorizer()
}
