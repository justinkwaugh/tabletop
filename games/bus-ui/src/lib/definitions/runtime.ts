import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { HydratedBusGameState, BusGameState } from '@tabletop/bus'
import { BusRuntime } from '@tabletop/bus'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { BusGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { BusGameSession } from '$lib/model/session.svelte.js'

export const BusUiRuntime: GameUIRuntime<BusGameState, HydratedBusGameState> = {
    ...BusRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: BusGameSession,
    colorizer: new BusGameColorizer()
}
