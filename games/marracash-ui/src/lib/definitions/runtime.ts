import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { HydratedMarracashGameState, MarracashProjectedState } from '@tabletop/marracash'
import { MarracashRuntime } from '@tabletop/marracash'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { DefaultColorizer } from '@tabletop/frontend-components'
import GameTable from '../components/GameTable.svelte'
import { MarracashGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const MarracashUiRuntime: GameUIRuntime<MarracashProjectedState, HydratedMarracashGameState> = {
    ...MarracashRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: MarracashGameSession,
    colorizer: new DefaultColorizer()
}
