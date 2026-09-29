import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { HydratedOathGameState, OathProjectedState } from '@tabletop/oath'
import { OathRuntime } from '@tabletop/oath'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { OathGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { OathGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const OathUiRuntime: GameUIRuntime<OathProjectedState, HydratedOathGameState> = {
    ...OathRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: OathGameSession,
    colorizer: new OathGameColorizer()
}
