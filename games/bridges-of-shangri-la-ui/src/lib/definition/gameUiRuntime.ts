import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { BridgesGameState, HydratedBridgesGameState } from '@tabletop/bridges-of-shangri-la'
import { BridgesRuntime } from '@tabletop/bridges-of-shangri-la'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { BridgesGameColorizer } from './gameColorizer.js'
import Table from '../components/Table.svelte'
import { BridgesGameSession } from '../model/BridgesGameSession.svelte.js'
import '../../app.css'

export const BridgesUiRuntime: GameUIRuntime<BridgesGameState, HydratedBridgesGameState> = {
    ...BridgesRuntime,
    gameUI: {
        component: Table,
        load: async () => Table,
        mount: mountDynamicComponent
    },
    sessionClass: BridgesGameSession,
    colorizer: new BridgesGameColorizer()
}
