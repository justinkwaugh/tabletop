import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import type { HydratedFeudumGameState, FeudumGameState } from '@tabletop/feudum'
import { FeudumRuntime } from '@tabletop/feudum'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { FeudumGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { FeudumGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const FeudumUiRuntime: GameUIRuntime<FeudumGameState, HydratedFeudumGameState> = {
    ...FeudumRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: FeudumGameSession,
    colorizer: new FeudumGameColorizer()
}
