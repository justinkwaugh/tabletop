import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import {
    LwRuntime,
    type HydratedLwGameState,
    type LwProjectedState
} from '@tabletop/locomotive-werks'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { LwColorizer } from './colorizer.js'
import { LwPalette } from './palette.js'
import GameTable from '../components/GameTable.svelte'
import { LwGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

export const LwUiRuntime: GameUIRuntime<LwProjectedState, HydratedLwGameState> = {
    ...LwRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: LwGameSession,
    colorizer: new LwColorizer(),
    playerColorPalette: LwPalette
}
