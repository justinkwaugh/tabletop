import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { HydratedSolGameState, SolGameState } from '@tabletop/sol'
import { SolRuntime } from '@tabletop/sol'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { SolGameColorizer } from './gameColorizer.js'
import Table from '../components/Table.svelte'
import { SolGameSession } from '$lib/model/SolGameSession.svelte.js'

export const SolUiRuntime: GameUIRuntime<SolGameState, HydratedSolGameState> = {
    ...SolRuntime,
    gameUI: {
        component: Table,
        load: async () => Table,
        mount: mountDynamicComponent
    },
    sessionClass: SolGameSession,
    colorizer: new SolGameColorizer()
}
