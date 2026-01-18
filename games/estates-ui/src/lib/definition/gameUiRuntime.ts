import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { EstatesGameState, HydratedEstatesGameState } from '@tabletop/estates'
import { EstatesRuntime } from '@tabletop/estates'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { EstatesGameColorizer } from './gameColorizer.js'
import Table from '../components/Table.svelte'
import { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte.js'

export const EstatesUiRuntime: GameUIRuntime<EstatesGameState, HydratedEstatesGameState> = {
    ...EstatesRuntime,
    gameUI: {
        component: Table,
        load: async () => Table,
        mount: mountDynamicComponent
    },
    sessionClass: EstatesGameSession,
    colorizer: new EstatesGameColorizer()
}
